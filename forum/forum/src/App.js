import './App.css';
import { useState, useEffect } from 'react';

const API_AUTH = 'http://localhost:5000/api';
const API_COMMUNITY = 'http://localhost:5000/community';

function App() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [field, setField] = useState('Home');
  const [formInfo, setFormInfo] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');

  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [posts, setPosts] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [serverBio, setServerBio] = useState('');
  const [postContent, setPostContent] = useState({ title: '', content: '' });
  const [commentInputs, setCommentInputs] = useState({});

  const [editingPosts, setEditingPosts] = useState({});
  const [editingComments, setEditingComments] = useState({});

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const res = await fetch(`${API_AUTH}/profile`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user || data);
          setIsSignedIn(true);
        } else {
          setIsSignedIn(false);
          setCurrentUser(null);
        }
      } catch (err) { console.error(err); }
    };
    restoreSession();
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchGroups();
  }, [isSignedIn]);

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_COMMUNITY}/groups`, { credentials: 'include' });
      const data = await res.json();
      setGroups(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (!selectedGroup) return;
    const fetchPosts = async () => {
      try {
        const res = await fetch(`${API_COMMUNITY}/groups/${selectedGroup._id}/posts`, { credentials: 'include' });
        const data = await res.json();
        const postsWithComments = data.map(p => ({ ...p, comments: p.comments || [] }));
        setPosts(postsWithComments);
      } catch (err) { console.error(err); }
    };
    fetchPosts();
  }, [selectedGroup]);

  const handleChange = (e) => setFormInfo({ ...formInfo, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const isLoggingIn = field === 'Sign-In';
    if (!isLoggingIn && formInfo.password !== formInfo.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const endpoint = isLoggingIn ? `${API_AUTH}/login` : `${API_AUTH}/register`;
    const payload = isLoggingIn
      ? { email: formInfo.email, password: formInfo.password }
      : { name: formInfo.name, email: formInfo.email, password: formInfo.password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Something went wrong');

      const prof = await fetch(`${API_AUTH}/profile`, { credentials: 'include' });
      if (prof.ok) {
        const profData = await prof.json();
        setCurrentUser(profData.user || profData);
      }

      setIsSignedIn(true);
      setField('Home');
    } catch (err) { setError(err.message); }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_AUTH}/logout`, { method: 'POST', credentials: 'include' });
    } catch {}
    setIsSignedIn(false);
    setCurrentUser(null);
    setField('Home');
    setSelectedGroup(null);
  };

  const createGroup = async () => {
    if (!groupName) { alert('Group name required'); return; }
    try {
      const res = await fetch(`${API_COMMUNITY}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ groupName, serverBio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setGroups(prev => [...prev, data]);
      setGroupName('');
      setServerBio('');
    } catch (err) { alert(err.message); }
  };

  const joinGroup = async (groupId) => {
    try {
      const res = await fetch(`${API_COMMUNITY}/groups/${groupId}/join`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      alert(data.message);
    } catch (err) { console.error(err); }
  };

  const createPost = async () => {
    if (!selectedGroup) { alert('Select a group first'); return; }
    if (!postContent.title || !postContent.content) { alert('Title and content required'); return; }

    try {
      const res = await fetch(`${API_COMMUNITY}/groups/${selectedGroup._id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(postContent),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setPosts(prev => [{ ...data, comments: [] }, ...prev]);
      setPostContent({ title: '', content: '' });
    } catch (err) { alert(err.message); }
  };

  const startEditPost = (post) => {
    setEditingPosts(prev => ({ ...prev, [post._id]: { title: post.title, content: post.content } }));
  };
  const cancelEditPost = (postId) => {
    setEditingPosts(prev => {
      const copy = { ...prev };
      delete copy[postId];
      return copy;
    });
  };
  const saveEditPost = async (postId) => {
    const edits = editingPosts[postId];
    if (!edits) return;
    try {
      const res = await fetch(`${API_COMMUNITY}/groups/${selectedGroup._id}/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: edits.title, content: edits.content })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setPosts(prev => prev.map(p => p._id === postId ? { ...data, comments: p.comments || [] } : p));
      cancelEditPost(postId);
    } catch (err) { alert(err.message); }
  };

  const deletePost = async (postId) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      const res = await fetch(`${API_COMMUNITY}/groups/${selectedGroup._id}/posts/${postId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch (err) { alert(err.message); }
  };

  const addComment = async (postId) => {
    const commentText = commentInputs[postId];
    if (!commentText) return;
    try {
      const res = await fetch(`${API_COMMUNITY}/groups/${selectedGroup._id}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: commentText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setPosts(prevPosts => prevPosts.map(p => p._id === postId ? { ...p, comments: [...(p.comments || []), data] } : p));

      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err) { alert(err.message); }
  };

  const startEditComment = (comment) => {
    setEditingComments(prev => ({ ...prev, [comment._id]: comment.body }));
  };
  const cancelEditComment = (commentId) => {
    setEditingComments(prev => {
      const copy = { ...prev };
      delete copy[commentId];
      return copy;
    });
  };
  const saveEditComment = async (postId, commentId) => {
    const text = editingComments[commentId];
    if (!text) return;
    try {
      const res = await fetch(`${API_COMMUNITY}/groups/${selectedGroup._id}/posts/${postId}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setPosts(prev => prev.map(p => {
        if (p._id !== postId) return p;
        return { ...p, comments: (p.comments || []).map(c => c._id === commentId ? data : c) };
      }));
      cancelEditComment(commentId);
    } catch (err) { alert(err.message); }
  };

  const deleteComment = async (postId, commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      const res = await fetch(`${API_COMMUNITY}/groups/${selectedGroup._id}/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setPosts(prev => prev.map(p => p._id === postId ? { ...p, comments: (p.comments || []).filter(c => c._id !== commentId) } : p));
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="App">
      <header>
        <div className='head-left'>
          <div className="logo">RedShit</div>
        </div>

        <div className='head-middle'>
          <form>
            <div className='search'>
              <span className="search-btn material-symbols-outlined">search</span>
              <input className='search-input' type='search' placeholder='Search...' />
            </div>
          </form>
        </div>

        <div className='head-right'>
          <button className="btn">News</button>
          {isSignedIn
            ? <button className="btn" onClick={handleLogout}>Logout</button>
            : <>
                <button className="btn" onClick={() => setField('Sign-In')}>Sign In</button>
                <button className="btn" onClick={() => setField('Sign-Up')}>Sign Up</button>
              </>
          }
        </div>
      </header>

      {/* Auth Forms */}
      {field === 'Sign-Up' &&
        <form className='reg' onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          <div className='input-area'>
            <span className="symbol material-symbols-outlined">person</span>
            <input type='text' name='name' placeholder='Username' className='input' onChange={handleChange} />
          </div>
          <div className='input-area'>
            <span className="symbol material-symbols-outlined">alternate_email</span>
            <input type='email' name='email' placeholder='Email' className='input' onChange={handleChange} />
          </div>
          <div className='input-area'>
            <span className="symbol material-symbols-outlined">lock</span>
            <input type='password' name='password' placeholder='Password' className='input' onChange={handleChange} />
          </div>
          <div className='input-area'>
            <span className="symbol material-symbols-outlined">lock</span>
            <input type='password' name='confirmPassword' placeholder='Confirm Password' className='input' onChange={handleChange} />
          </div>
          <div className='confirm-area'>
            <span className="material-symbols-outlined">check</span>
            <button type='submit' className='submit'>Sign Up</button>
          </div>
        </form>
      }

      {field === 'Sign-In' &&
        <form className='reg' onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          <div className='input-area'>
            <span className="symbol material-symbols-outlined">alternate_email</span>
            <input type='email' name='email' placeholder='Email' className='input' onChange={handleChange} />
          </div>
          <div className='input-area'>
            <span className="symbol material-symbols-outlined">lock</span>
            <input type='password' name='password' placeholder='Password' className='input' onChange={handleChange} />
          </div>
          <div className='confirm-area'>
            <span className="material-symbols-outlined">check</span>
            <button type='submit' className='submit'>Sign In</button>
          </div>
        </form>
      }

      {/* Main Content */}
      {isSignedIn && field === 'Home' &&
        <main className="content">
          {!selectedGroup
            ? <section className='placeholder'>
                <h2 className="groups-header">Groups</h2>
                <div className='group-inputs'>
                  <input
                    placeholder='Group Name'
                    className='group-name-input'
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                  />
                  <textarea
                    placeholder='Server Bio'
                    className='group-bio-input'
                    value={serverBio}
                    onChange={e => setServerBio(e.target.value)}
                  />
                  <button onClick={createGroup} className='create-btn'>Create Group</button>
                </div>

                <ul className="groups-list">
                  {groups.map(g => (
                    <li key={g._id} className="post-card">
                      <h3 className="group-title">{g.groupName}</h3>
                      <p className="group-bio">{g.serverBio}</p>
                      <div className="group-actions">
                        <button className="btn" onClick={() => joinGroup(g._id)}>Join</button>
                        <button className="btn" onClick={() => setSelectedGroup(g)}>View Posts</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            : <section className="group-page">
                <div className='posts-header'>
                  <button className="btn" onClick={() => setSelectedGroup(null)}>Back to Groups</button>
                  <h2 className="group-title-inline">Posts in {selectedGroup.groupName}</h2>
                </div>

                <div className="post-creator">
                  <input
                    placeholder='Title'
                    className="group-name-input"
                    value={postContent.title}
                    onChange={e => setPostContent(prev => ({ ...prev, title: e.target.value }))}
                  />
                  <textarea
                    placeholder='Content'
                    className="group-bio-input"
                    value={postContent.content}
                    onChange={e => setPostContent(prev => ({ ...prev, content: e.target.value }))}
                  />
                  <div className="creator-actions">
                    <button onClick={createPost} className="create-btn">Create Post</button>
                  </div>
                </div>

                <div className="post-area">
                  {posts.map(p => (
                    <article key={p._id} className="post-card">
                      {editingPosts[p._id]
                        ? <div className="post-edit-form">
                            <input
                              className="group-name-input"
                              value={editingPosts[p._id].title}
                              onChange={e => setEditingPosts(prev => ({ ...prev, [p._id]: { ...prev[p._id], title: e.target.value } }))}
                            />
                            <textarea
                              className="group-bio-input"
                              value={editingPosts[p._id].content}
                              onChange={e => setEditingPosts(prev => ({ ...prev, [p._id]: { ...prev[p._id], content: e.target.value } }))}
                            />
                            <div className="post-actions">
                              <button className="btn btn-primary" onClick={() => saveEditPost(p._id)}>Save</button>
                              <button className="btn" onClick={() => cancelEditPost(p._id)}>Cancel</button>
                            </div>
                          </div>
                        : <div className="post-view">
                            <h3>{p.title}</h3>
                            <p className="post-body">{p.content}</p>
                            <div className="post-meta">
                              <span className="small">Author: {p.author?.username || p.author?.name || 'Unknown'}</span>
                              <span className="small">{p.createdAt ? new Date(p.createdAt).toLocaleString() : (p.timestamp ? new Date(p.timestamp).toLocaleString() : '')}</span>
                            </div>

                            <div className="post-actions">
                              <button className="btn" onClick={() => startEditPost(p)}>Edit</button>
                              <button className="btn" onClick={() => deletePost(p._id)}>Delete</button>
                            </div>
                          </div>
                      }

                      <div className="comments">
                        <strong>Comments:</strong>
                        {p.comments && p.comments.length > 0
                          ? p.comments.map(c => {
                              const authorName = c.user?.username || c.user?.name || c.author?.username || 'User';
                              const commentText = c.body || c.text || c.content || '';
                              return (
                                <div key={c._id || c.id} className="comment">
                                  {editingComments[c._id]
                                    ? <div className="comment-edit">
                                        <input
                                          className="input"
                                          value={editingComments[c._id]}
                                          onChange={e => setEditingComments(prev => ({ ...prev, [c._1]: e.target.value, [c._id]: e.target.value }))}
                                        />
                                        <div className="comment-actions">
                                          <button className="btn btn-primary" onClick={() => saveEditComment(p._id, c._id)}>Save</button>
                                          <button className="btn" onClick={() => cancelEditComment(c._id)}>Cancel</button>
                                        </div>
                                      </div>
                                    : <div className="comment-view">
                                        <div className="comment-author">{authorName}</div>
                                        <div className="comment-body">{commentText}</div>
                                        <div className="comment-actions">
                                          <button className="btn" onClick={() => startEditComment(c)}>Edit</button>
                                          <button className="btn" onClick={() => deleteComment(p._id, c._id)}>Delete</button>
                                        </div>
                                      </div>
                                  }
                                </div>
                              );
                            })
                          : <div className="comment"><div className="comment-body">No comments yet</div></div>
                        }
                      </div>

                      <div className="comment-input-row">
                        <input
                          placeholder='Comment...'
                          className="input"
                          value={commentInputs[p._1] || commentInputs[p._id] || ''}
                          onChange={e => setCommentInputs(prev => ({ ...prev, [p._id]: e.target.value }))}
                        />
                        <button className="btn btn-primary" onClick={() => addComment(p._id)}>Add Comment</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
          }
        </main>
      }
    </div>
  );
}

export default App;