const express = require('express');
const { Group, Post, Comment } = require('../Models/Group');
const authenticate = require('../Middleware/Authenticate');
const router = express.Router();

// Create group
router.post('/groups', authenticate, async (req, res) => {
  const { groupName, serverBio } = req.body;

  try {
    const newGroup = new Group({
      groupName,
      serverBio: serverBio || 'Not Provided',
      creator: req.user.userId,
      members: [req.user.userId]
    });

    await newGroup.save();
    res.status(201).json(newGroup);
  } catch (err) {
    console.error(`Error creating a group: ${err}`);
    res.status(500).json({ message: 'Failed to create group' });
  }
});

router.get('/groups', async (req, res) => {
  try {
    const groups = await Group.find();
    res.status(200).json(groups);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ message: 'Failed to fetch groups' });
  }
});

// Join group
router.post('/groups/:groupId/join', authenticate, async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.userId;

    const group = await Group.findById(groupId);
    if (!group) return res.status(400).json({ message: "Group doesn't exist" });

    if (group.members.includes(userId)) return res.status(400).json({ message: 'User is already member' });

    group.members.push(userId);
    await group.save();

    return res.status(200).json({ message: 'Successfully joined the group' });
  } catch (err) {
    console.log(`Error joining group: ${err}`);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /groups/:groupId/posts
// Return posts with author and comments (comments.user) populated
router.get('/groups/:groupId/posts', async (req, res) => {
  const { groupId } = req.params;

  try {
    const posts = await Post.find({ group: groupId })
      .sort({ createdAt: -1 })
      .populate('author', 'username name email')
      .populate({
        path: 'comments',
        populate: { path: 'user', select: 'username name' }
      })
      .lean();

    const normalizedPosts = posts.map(p => ({
      _id: p._id,
      title: p.title,
      content: p.content,
      score: p.score || 0,
      userVote: null,
      comments: p.comments || [],
      commentsCount: p.comments ? p.comments.length : 0,
      createdAt: p.createdAt,
      author: p.author
    }));

    res.status(200).json(normalizedPosts);
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ message: 'Failed to fetch posts' });
  }
});

// POST /groups/:groupId/posts/:postId/comments
router.post('/groups/:groupId/posts/:postId/comments', authenticate, async (req, res) => {
  const { groupId, postId } = req.params;
  const userId = req.user.userId;
  // accept either { body } or { text }
  const { body, text } = req.body;
  const commentBody = body || text;

  if (!commentBody) return res.status(400).json({ message: "Comment body is required" });

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (!group.members.includes(userId)) return res.status(403).json({ message: 'User is not a member of the group' });

    const post = await Post.findById(postId);
    if (!post || post.group.toString() !== groupId) return res.status(404).json({ message: 'Post not found in this group' });

    const comment = new Comment({
      body: commentBody,
      user: userId,
      post: postId
    });

    await comment.save();

    // populate user info from DB to ensure username/name is present in response
    await comment.populate({ path: 'user', select: 'username name' });

    res.status(201).json({
      _id: comment._id,
      body: comment.body,
      user: comment.user, // will be { _id, username?, name? }
      createdAt: comment.createdAt,
      post: comment.post
    });
  } catch (err) {
    console.error("Error adding comment:", err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// EDIT a comment
router.put('/groups/:groupId/posts/:postId/comments/:commentId', authenticate, async (req, res) => {
  const { groupId, postId, commentId } = req.params;
  const userId = req.user.userId;
  const { body, text } = req.body;
  const commentBody = body || text;

  if (!commentBody) return res.status(400).json({ message: 'Comment body is required' });

  try {
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.post.toString() !== postId) return res.status(400).json({ message: 'Comment does not belong to this post' });
    if (comment.user.toString() !== userId) return res.status(403).json({ message: 'Not allowed to edit this comment' });

    comment.body = commentBody;
    await comment.save();

    await comment.populate({ path: 'user', select: 'username name' });

    res.status(200).json({
      _id: comment._id,
      body: comment.body,
      user: comment.user,
      createdAt: comment.createdAt,
      post: comment.post
    });
  } catch (err) {
    console.error('Error editing comment:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE a comment
router.delete('/groups/:groupId/posts/:postId/comments/:commentId', authenticate, async (req, res) => {
  const { groupId, postId, commentId } = req.params;
  const userId = req.user.userId;

  try {
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.post.toString() !== postId) return res.status(400).json({ message: 'Comment does not belong to this post' });

    // allow deletion by comment owner or group creator
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isOwner = comment.user.toString() === userId;
    const isGroupCreator = group.creator.toString() === userId;

    if (!isOwner && !isGroupCreator) return res.status(403).json({ message: 'Not allowed to delete this comment' });

    // Use model-level delete to avoid relying on document.remove()
    await Comment.deleteOne({ _id: commentId });

    res.status(200).json({ message: 'Comment deleted', commentId });
  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// EDIT a post
router.put('/groups/:groupId/posts/:postId', authenticate, async (req, res) => {
  const { groupId, postId } = req.params;
  const userId = req.user.userId;
  const { title, content } = req.body;

  if (!title && !content) return res.status(400).json({ message: 'Title or content required to update' });

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.group.toString() !== groupId) return res.status(400).json({ message: 'Post does not belong to this group' });
    if (post.author.toString() !== userId) return res.status(403).json({ message: 'Not allowed to edit this post' });

    if (title) post.title = title;
    if (content) post.content = content;
    await post.save();

    await post.populate({ path: 'author', select: 'username name' });

    res.status(200).json({
      _id: post._id,
      title: post.title,
      content: post.content,
      author: post.author,
      createdAt: post.createdAt
    });
  } catch (err) {
    console.error('Error editing post:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE a post (and its comments)
router.delete('/groups/:groupId/posts/:postId', authenticate, async (req, res) => {
  const { groupId, postId } = req.params;
  const userId = req.user.userId;

  try {
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    if (post.group.toString() !== groupId) return res.status(400).json({ message: 'Post does not belong to this group' });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // allow deletion by post author or group creator
    const isOwner = post.author.toString() === userId;
    const isGroupCreator = group.creator.toString() === userId;

    if (!isOwner && !isGroupCreator) return res.status(403).json({ message: 'Not allowed to delete this post' });

    // remove comments linked to this post
    await Comment.deleteMany({ post: postId });

    // Use model-level delete to remove the post
    await Post.deleteOne({ _id: postId });

    res.status(200).json({ message: 'Post deleted', postId });
  } catch (err) {
    console.error('Error deleting post:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /groups/:groupId/posts
router.post('/groups/:groupId/posts', authenticate, async (req, res) => {
  const { groupId } = req.params;
  const { title, content } = req.body;
  const userId = req.user.userId;

  if (!title || !content) return res.status(400).json({ message: 'Title and content are required' });

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });
    if (!group.members.includes(userId)) return res.status(403).json({ message: 'You are not a member of this group' });

    const newPost = new Post({
      group: groupId,
      author: userId,
      title,
      content
    });

    await newPost.save();

    await newPost.populate({ path: 'author', select: 'username name' });

    res.status(201).json({
      _id: newPost._id,
      title: newPost.title,
      content: newPost.content,
      author: { _id: newPost.author._id, username: newPost.author.username || null, name: newPost.author.name || null },
      createdAt: newPost.createdAt
    });
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ message: 'Failed to create post' });
  }
});

module.exports = router;