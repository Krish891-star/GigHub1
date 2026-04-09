const API_URL = window.location.origin;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));

  if (!token || !user) {
    window.location.href = '/login';
    return;
  }

  // Display user info
  document.getElementById('userName').textContent = `👤 ${user.name}`;

  // Show/hide buttons based on role
  if (user.role === 'creator') {
    document.getElementById('createPostBtn').classList.add('hidden');
    document.getElementById('viewPostsBtn').textContent = '🔍 View All Posts';
  }

  // Add mobile menu functionality
  if (window.innerWidth <= 768) {
    optimizeForMobile();
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth <= 768) {
      optimizeForMobile();
    }
  });

  // Load dashboard by default
  setTimeout(() => {
    loadDashboard();
  }, 300);
});

// Mobile optimization
function optimizeForMobile() {
  // Make sure all buttons are accessible
  const buttons = document.querySelectorAll('.navbar .nav-links button');
  buttons.forEach(btn => {
    btn.style.minHeight = '44px'; // iOS recommended touch target
  });
}

// ==========================================
// NAVIGATION
// ==========================================

function showDashboard() {
  hideAllSections();
  document.getElementById('dashboardSection').classList.remove('hidden');
  
  const user = JSON.parse(localStorage.getItem('user'));
  if (user.role === 'user') {
    document.getElementById('myPostsSection').classList.remove('hidden');
    loadMyPosts();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showCreatePost() {
  hideAllSections();
  document.getElementById('createPostSection').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAllPosts() {
  hideAllSections();
  document.getElementById('allPostsSection').classList.remove('hidden');
  loadAllPosts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showCreators() {
  hideAllSections();
  document.getElementById('creatorsSection').classList.remove('hidden');
  loadCreators();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hideAllSections() {
  const sections = [
    'dashboardSection',
    'createPostSection',
    'allPostsSection',
    'myPostsSection',
    'creatorsSection',
    'statusShortsUploadSection',
    'statusShortsFeedSection',
    'myStatusShortsSection'
  ];
  
  sections.forEach(sectionId => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.classList.add('hidden');
      element.style.opacity = '';
      element.style.transform = '';
    }
  });
}

// ==========================================
// STATUS & SHORTS NAVIGATION
// ==========================================

function showStatusShorts() {
  hideAllSections();
  document.getElementById('statusShortsFeedSection').classList.remove('hidden');
  loadStatusShortsFeed('latest', 'all');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showStatusShortsUpload() {
  hideAllSections();
  document.getElementById('statusShortsUploadSection').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showMyStatusShorts() {
  hideAllSections();
  document.getElementById('myStatusShortsSection').classList.remove('hidden');
  loadMyStatusShorts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// API HELPERS
// ==========================================

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

function showAlert(message, type = 'error') {
  const alertContainer = document.getElementById('alertContainer');
  if (!alertContainer) {
    console.error('Alert container not found');
    alert(message);
    return;
  }
  
  alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => {
    alertContainer.innerHTML = '';
  }, 5000);
}

// ==========================================
// DASHBOARD
// ==========================================

async function loadDashboard() {
  try {
    const response = await fetch(`${API_URL}/api/dashboard`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();
    const user = JSON.parse(localStorage.getItem('user'));

    if (response.ok && data.stats) {
      if (user.role === 'user') {
        document.getElementById('stat1').textContent = data.stats.myPosts || 0;
        document.getElementById('stat1Label').textContent = 'My Posts';
        document.getElementById('stat2').textContent = data.stats.openPosts || 0;
        document.getElementById('stat2Label').textContent = 'Open';
        document.getElementById('stat3').textContent = data.stats.completedPosts || 0;
        document.getElementById('stat3Label').textContent = 'Completed';
      } else {
        document.getElementById('stat1').textContent = data.stats.totalPosts || 0;
        document.getElementById('stat1Label').textContent = 'Total Posts';
        document.getElementById('stat2').textContent = data.stats.openPosts || 0;
        document.getElementById('stat2Label').textContent = 'Open Opportunities';
        document.getElementById('stat3').textContent = data.stats.totalCreators || 0;
        document.getElementById('stat3Label').textContent = 'Active Creators';
      }

      showDashboard();
    }
  } catch (err) {
    console.error('Error loading dashboard:', err);
    showAlert('Failed to load dashboard');
  }
}

// ==========================================
// CREATE POST
// ==========================================

document.getElementById('createPostForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('postTitle').value.trim();
  const category = document.getElementById('postCategory').value;
  const description = document.getElementById('postDescription').value.trim();
  const budget = document.getElementById('postBudget').value.trim();
  const whatsapp = document.getElementById('postWhatsapp').value.trim();
  const images = document.getElementById('postImages').files;

  try {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('category', category);
    formData.append('description', description);
    formData.append('budget', budget);
    if (whatsapp) formData.append('whatsapp', whatsapp);

    for (let i = 0; i < images.length; i++) {
      formData.append('images', images[i]);
    }

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      showAlert('Post created successfully!', 'success');
      document.getElementById('createPostForm').reset();
      setTimeout(() => {
        showDashboard();
      }, 1000);
    } else {
      showAlert(data.error || 'Failed to create post');
    }
  } catch (err) {
    showAlert('Network error. Please try again.');
  }
});

// ==========================================
// LOAD POSTS
// ==========================================

async function loadAllPosts(filter = 'all') {
  try {
    let url = `${API_URL}/api/posts`;
    if (filter !== 'all') {
      if (['open', 'in-progress', 'completed', 'closed'].includes(filter)) {
        url += `?status=${filter}`;
      } else {
        url += `?category=${filter}`;
      }
    }

    const response = await fetch(url);
    const data = await response.json();

    if (response.ok) {
      displayPosts(data.posts, 'postsContainer');
    }
  } catch (err) {
    console.error('Error loading posts:', err);
  }
}

async function loadMyPosts() {
  try {
    const response = await fetch(`${API_URL}/api/posts/my`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      displayPosts(data.posts, 'myPostsContainer', true);
    }
  } catch (err) {
    console.error('Error loading my posts:', err);
  }
}

function displayPosts(posts, containerId, showActions = false) {
  const container = document.getElementById(containerId);

  if (!posts || posts.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #718096; padding: 3rem; font-size: 1.1rem; font-weight: 600;">📭 No posts found</p>';
    return;
  }

  container.innerHTML = posts.map((post, index) => `
    <div class="post-card" style="animation: fadeInUp 0.5s ease ${index * 0.1}s both;">
      <div class="post-header">
        <h3>${escapeHtml(post.title)}</h3>
        <span class="post-category">${formatCategory(post.category)}</span>
      </div>
      <div class="post-body">
        <p>${escapeHtml(post.description)}</p>
        <div class="post-budget">💰 ${escapeHtml(post.budget)}</div>
        ${post.images && post.images.length > 0 ? `
          <div class="image-gallery">
            ${post.images.map(img => `<img src="${API_URL}${img}" alt="Post image">`).join('')}
          </div>
        ` : ''}
        <div class="contact-info">
          <p><strong>📞 Contact:</strong> ${escapeHtml(post.userPhone || 'N/A')}</p>
          ${post.userWhatsapp ? `<p><strong>💬 WhatsApp:</strong> <a href="https://wa.me/${post.userWhatsapp.replace(/[^0-9]/g, '')}" target="_blank">Message on WhatsApp →</a></p>` : ''}
          <p><strong>👤 Posted by:</strong> ${escapeHtml(post.userName || 'Anonymous')}</p>
        </div>
      </div>
      <div class="post-footer">
        <span class="post-date">🕒 ${formatDate(post.createdAt)}</span>
        <span class="status-badge status-${post.status}">${post.status.toUpperCase()}</span>
      </div>
      ${showActions ? `
        <div style="padding: 1.25rem 1.5rem; border-top: 1px solid #e2e8f0; display: flex; gap: 0.75rem; background: #f7fafc;">
          <button class="btn btn-success" onclick="updatePostStatus('${post._id || post.id}', 'completed')" style="flex: 1;">✅ Mark Complete</button>
          <button class="btn btn-danger" onclick="deletePost('${post._id || post.id}')" style="flex: 1;">🗑️ Delete</button>
        </div>
      ` : ''}
    </div>
  `).join('');
  
  // Add animation keyframes
  if (!document.getElementById('fadeInUp-style')) {
    const style = document.createElement('style');
    style.id = 'fadeInUp-style';
    style.textContent = `
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

function filterPosts(filter) {
  // Update active tab
  const tabs = document.querySelectorAll('#allPostsSection .tab');
  tabs.forEach(tab => {
    tab.classList.remove('active');
  });
  
  if (event && event.target) {
    event.target.classList.add('active');
  }

  loadAllPosts(filter);
}

// ==========================================
// POST ACTIONS
// ==========================================

async function updatePostStatus(postId, status) {
  try {
    const response = await fetch(`${API_URL}/api/posts/${postId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });

    const data = await response.json();

    if (response.ok) {
      showAlert('Post updated successfully!', 'success');
      loadMyPosts();
      loadDashboard();
    } else {
      showAlert(data.error || 'Failed to update post');
    }
  } catch (err) {
    showAlert('Network error. Please try again.');
  }
}

async function deletePost(postId) {
  if (!confirm('Are you sure you want to delete this post?')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/posts/${postId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      showAlert('Post deleted successfully!', 'success');
      loadMyPosts();
      loadDashboard();
    } else {
      showAlert(data.error || 'Failed to delete post');
    }
  } catch (err) {
    showAlert('Network error. Please try again.');
  }
}

// ==========================================
// CREATORS
// ==========================================

async function loadCreators() {
  try {
    const response = await fetch(`${API_URL}/api/creators`);
    const data = await response.json();

    if (response.ok) {
      displayCreators(data.creators);
    }
  } catch (err) {
    console.error('Error loading creators:', err);
  }
}

function displayCreators(creators) {
  const container = document.getElementById('creatorsContainer');

  if (!creators || creators.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #718096; padding: 3rem; font-size: 1.1rem; font-weight: 600;">🎨 No creators found</p>';
    return;
  }

  container.innerHTML = creators.map((creator, index) => `
    <div class="creator-card" style="animation: fadeInUp 0.5s ease ${index * 0.1}s both;">
      <div class="creator-header">
        <div class="creator-avatar">${creator.name.charAt(0).toUpperCase()}</div>
        <div class="creator-info">
          <h3>${escapeHtml(creator.name)}</h3>
          <p>⭐ ${creator.rating || 0} Rating | ✅ ${creator.completedProjects || 0} Projects</p>
        </div>
      </div>
      ${creator.bio ? `<p style="color: #4a5568; margin-bottom: 1.25rem; line-height: 1.6;">${escapeHtml(creator.bio)}</p>` : ''}
      ${creator.skills && creator.skills.length > 0 ? `
        <div class="skills-list">
          ${creator.skills.map(skill => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join('')}
        </div>
      ` : ''}
      <div class="contact-info" style="margin-top: 1.25rem;">
        <p><strong>📞 Phone:</strong> ${escapeHtml(creator.phone || 'N/A')}</p>
        ${creator.whatsapp ? `<p><strong>💬 WhatsApp:</strong> <a href="https://wa.me/${creator.whatsapp.replace(/[^0-9]/g, '')}" target="_blank">Message →</a></p>` : ''}
        ${creator.email ? `<p><strong>📧 Email:</strong> ${escapeHtml(creator.email)}</p>` : ''}
      </div>
    </div>
  `).join('');
}

// ==========================================
// LOGOUT
// ==========================================

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatCategory(category) {
  const categories = {
    'poster': '🖼️ Poster',
    'banner': '🎯 Banner',
    'wedding-card': '💒 Wedding Card',
    'website': '🌐 Website',
    'seo': '📈 SEO',
    'logo': '🎨 Logo',
    'video': '🎥 Video',
    'other': '📦 Other'
  };
  return categories[category] || category;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffTime / (1000 * 60));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// ==========================================
// STATUS & SHORTS FUNCTIONALITY
// ==========================================

// Upload Status or Shorts
document.getElementById('statusShortsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const type = document.getElementById('ssType').value;
  const caption = document.getElementById('ssCaption').value.trim();
  const media = document.getElementById('ssMedia').files[0];

  if (!media) {
    showAlert('Please select a media file');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('media', media);
    formData.append('type', type);
    if (caption) formData.append('caption', caption);

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/status-shorts/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();

    if (response.ok) {
      showAlert('Upload successful! 🎉', 'success');
      document.getElementById('statusShortsForm').reset();
      setTimeout(() => {
        showStatusShorts();
      }, 1000);
    } else {
      showAlert(data.error || 'Upload failed');
    }
  } catch (err) {
    showAlert('Network error. Please try again.');
  }
});

// Load Status & Shorts Feed
async function loadStatusShortsFeed(tab = 'latest', type = 'all') {
  try {
    // Update active tab
    const tabs = document.querySelectorAll('#statusShortsFeedSection .tab');
    tabs.forEach(t => t.classList.remove('active'));
    
    // Find and activate the correct tab
    tabs.forEach(t => {
      const text = t.textContent.toLowerCase();
      if (tab === 'latest' && type === 'all' && text.includes('latest')) {
        t.classList.add('active');
      } else if (tab === 'popular' && text.includes('popular')) {
        t.classList.add('active');
      } else if (type === 'status' && text.includes('status')) {
        t.classList.add('active');
      } else if (type === 'shorts' && text.includes('shorts')) {
        t.classList.add('active');
      }
    });

    let url = `${API_URL}/api/status-shorts/feed?tab=${tab}&limit=20`;
    if (type !== 'all') {
      url += `&type=${type}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (response.ok) {
      displayStatusShorts(data.posts, 'statusShortsContainer');
    }
  } catch (err) {
    console.error('Error loading feed:', err);
  }
}

// Load My Status & Shorts
async function loadMyStatusShorts() {
  try {
    const response = await fetch(`${API_URL}/api/status-shorts/my`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      displayStatusShorts(data.posts, 'myStatusShortsContainer', true);
    }
  } catch (err) {
    console.error('Error loading my posts:', err);
  }
}

// Display Status & Shorts
function displayStatusShorts(posts, containerId, showActions = false) {
  const container = document.getElementById(containerId);

  if (!posts || posts.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #718096; padding: 3rem; font-size: 1.1rem; font-weight: 600;">📭 No posts found</p>';
    return;
  }

  container.innerHTML = posts.map((post, index) => {
    const isLiked = post.likes && post.likes.includes(JSON.parse(localStorage.getItem('user')).id);
    
    return `
    <div class="post-card" style="animation: fadeInUp 0.5s ease ${index * 0.1}s both;">
      <div class="post-header">
        <h3>${escapeHtml(post.userName || 'Anonymous')}</h3>
        <span class="post-category">${post.type === 'status' ? '⏰ Status' : '🎬 Shorts'}</span>
        <span class="status-badge-type ${post.type === 'status' ? 'badge-status' : 'badge-shorts'}">
          ${post.mediaType === 'video' ? '📹 Video' : '🖼️ Image'}
        </span>
      </div>
      
      ${post.mediaType === 'video' ? `
        <div class="video-container">
          <video src="${API_URL}${post.mediaUrl}" controls playsinline></video>
        </div>
      ` : `
        <img src="${API_URL}${post.mediaUrl}" style="width: 100%; max-height: 600px; object-fit: cover;" alt="Media">
      `}
      
      <div class="post-body">
        ${post.caption ? `<p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem;">${escapeHtml(post.caption)}</p>` : ''}
        
        <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
          <button class="btn btn-secondary" onclick="likeStatusShort('${post._id || post.id}', this)" style="flex: 1; padding: 0.75rem;">
            ${isLiked ? '❤️' : '🤍'} ${post.likes?.length || 0} Likes
          </button>
          <button class="btn btn-secondary" onclick="toggleComments('${post._id || post.id}')" style="flex: 1; padding: 0.75rem;">
            💬 ${post.comments?.length || 0} Comments
          </button>
          <div style="flex: 1; padding: 0.75rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; text-align: center; font-weight: 700;">
            👁️ ${post.viewCount || 0} Views
          </div>
        </div>

        <div class="contact-info">
          <p><strong>🕒 Posted:</strong> ${formatDate(post.createdAt)}</p>
          ${post.type === 'status' ? '<p style="color: #f5576c; font-weight: 600;">⏰ Expires in 24 hours</p>' : ''}
        </div>

        <div id="comments-${post._id || post.id}" class="comments-section" style="display: none;">
          <h4 style="margin-bottom: 1rem; color: #667eea;">💬 Comments</h4>
          <div id="comments-list-${post._id || post.id}">
            ${(post.comments || []).map(comment => `
              <div class="comment-item">
                <strong>${escapeHtml(comment.userName)}</strong>
                <small style="float: right;">${formatDate(comment.timestamp)}</small>
                <p>${escapeHtml(comment.text)}</p>
              </div>
            `).join('')}
          </div>
          <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
            <input type="text" id="comment-input-${post._id || post.id}" placeholder="Add a comment..." 
              style="flex: 1; padding: 0.75rem; border: 2px solid #e2e8f0; border-radius: 8px;">
            <button class="btn" onclick="addComment('${post._id || post.id}')" style="padding: 0.75rem 1.5rem;">Post</button>
          </div>
        </div>
      </div>

      ${showActions ? `
        <div style="padding: 1.25rem 1.5rem; border-top: 1px solid #e2e8f0; background: #f7fafc;">
          <button class="btn btn-danger" onclick="deleteStatusShort('${post._id || post.id}')" style="width: 100%;">🗑️ Delete</button>
        </div>
      ` : ''}
    </div>
  `;
  }).join('');
}

// Like Status & Shorts
async function likeStatusShort(postId, button) {
  try {
    const response = await fetch(`${API_URL}/api/status-shorts/${postId}/like`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      button.innerHTML = `${data.liked ? '❤️' : '🤍'} ${data.likes} Likes`;
    }
  } catch (err) {
    console.error('Error liking post:', err);
  }
}

// Toggle Comments
function toggleComments(postId) {
  const commentsSection = document.getElementById(`comments-${postId}`);
  if (commentsSection.style.display === 'none') {
    commentsSection.style.display = 'block';
  } else {
    commentsSection.style.display = 'none';
  }
}

// Add Comment
async function addComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const text = input.value.trim();

  if (!text) {
    showAlert('Please enter a comment');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/status-shorts/${postId}/comment`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (response.ok) {
      input.value = '';
      showAlert('Comment added! 💬', 'success');
      
      // Refresh the feed to show new comment
      const feedSection = document.getElementById('statusShortsFeedSection');
      if (!feedSection.classList.contains('hidden')) {
        const activeTab = document.querySelector('#statusShortsFeedSection .tab.active');
        if (activeTab) {
          activeTab.click();
        }
      }
    } else {
      showAlert(data.error || 'Failed to add comment');
    }
  } catch (err) {
    showAlert('Network error. Please try again.');
  }
}

// Delete Status & Shorts
async function deleteStatusShort(postId) {
  if (!confirm('Are you sure you want to delete this post?')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/status-shorts/${postId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      showAlert('Post deleted successfully! 🗑️', 'success');
      loadMyStatusShorts();
    } else {
      showAlert(data.error || 'Failed to delete post');
    }
  } catch (err) {
    showAlert('Network error. Please try again.');
  }
}

// Track view when video is played
function trackView(postId) {
  fetch(`${API_URL}/api/status-shorts/${postId}/view`, {
    method: 'POST',
    headers: getAuthHeaders()
  }).catch(err => console.error('Error tracking view:', err));
}
