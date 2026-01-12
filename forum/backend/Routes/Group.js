const express = require('express');
const { Group, Post, Comment } = require('../Models/Group');
const User = require('../Models/User'); // make sure this path matches your project
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
      createdAt: comment.createdAt
    });
  } catch (err) {
    console.error("Error adding comment:", err);
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

    res.status(201).json({
      _id: newPost._id,
      title: newPost.title,
      content: newPost.content,
      author: { _id: req.user.userId, username: req.user.username || null },
      createdAt: newPost.createdAt
    });
  } catch (err) {
    console.error('Error creating post:', err);
    res.status(500).json({ message: 'Failed to create post' });
  }
});

module.exports = router;