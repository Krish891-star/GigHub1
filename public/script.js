const API_URL = window.location.origin;
let currentUser = null;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, checking auth...');
  
  try {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) {
      console.log('No auth found, redirecting to login');
      window.location.href = '/login';
      return;
    }

    currentUser = user;
    console.log('User authenticated:', user.name);

    // Update profile section safely
    const profileUsername = document.getElementById('profileUsername');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileName = document.getElementById('profileName');
    
    if (profileUsername) profileUsername.textContent = user.name.toLowerCase().replace(/\s/g, '');
    if (profileAvatar) profileAvatar.textContent = user.name.charAt(0).toUpperCase();
    if (profileName) profileName.textContent = user.name;

    // Load feed by default
    setTimeout(() => {
      console.log('Initializing app...');
      try {
        loadFeed();
        loadStories();
        loadDashboard();
        console.log('App initialized successfully');
      } catch (err) {
        console.error('Error during initialization:', err);
      }
    }, 300);
  } catch (err) {
    console.error('Auth check error:', err);
    window.location.href = '/login';
  }
});

// ==========================================
// NAVIGATION
// ==========================================

function showSection(sectionName) {
  console.log('Navigating to:', sectionName);
  
  try {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
      section.classList.remove('active');
      section.style.display = '';  // Remove inline style to let CSS handle it
    });

    // Show selected section
    const targetSection = document.getElementById(sectionName + 'Section');
    if (targetSection) {
      targetSection.classList.add('active');
      targetSection.style.display = '';  // Remove inline style to let CSS handle it
      console.log('Section shown:', sectionName);
    } else {
      console.error('Section not found:', sectionName + 'Section');
      return;
    }

    // Update nav icons
    const navIcons = document.querySelectorAll('.nav-icon');
    navIcons.forEach(icon => icon.classList.remove('active'));

    // Update bottom nav
    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
    bottomNavItems.forEach(item => item.classList.remove('active'));

    // Activate appropriate icon - handle both top and bottom nav separately
    const topIconMap = {
      'feed': 0,
      'explore': 1,
      'reels': 2,
      'create': 3,
      'upload': 4,
      'profile': 5,
      'logout': 6
    };

    const bottomIconMap = {
      'feed': 0,
      'explore': 1,
      'reels': 2,
      'create': -1,  // No create button in bottom nav
      'upload': 3,
      'profile': 4
    };

    // Update top navigation
    if (topIconMap[sectionName] !== undefined && topIconMap[sectionName] >= 0) {
      if (navIcons[topIconMap[sectionName]]) {
        navIcons[topIconMap[sectionName]].classList.add('active');
      }
    }

    // Update bottom navigation
    if (bottomIconMap[sectionName] !== undefined && bottomIconMap[sectionName] >= 0) {
      if (bottomNavItems[bottomIconMap[sectionName]]) {
        bottomNavItems[bottomIconMap[sectionName]].classList.add('active');
      }
    }

    // Load section-specific data
    switch(sectionName) {
      case 'feed':
        loadFeed();
        break;
      case 'explore':
        loadExplore();
        break;
      case 'reels':
        loadReelsFeed();
        break;
      case 'profile':
        loadProfile();
        break;
      case 'create':
      case 'upload':
        console.log(sectionName === 'create' ? 'Create post section ready' : 'Upload section ready');
        break;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    console.error('Error showing section:', err);
    alert('Error: ' + err.message);
  }
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
    alert(message);
    return;
  }
  
  alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => {
    alertContainer.innerHTML = '';
  }, 5000);
}

// ==========================================
// STORIES
// ==========================================

async function loadStories() {
  try {
    const response = await fetch(`${API_URL}/api/status-shorts/feed?tab=latest&limit=10`);
    const data = await response.json();

    if (response.ok && data.posts) {
      displayStories(data.posts);
    }
  } catch (err) {
    console.error('Error loading stories:', err);
  }
}

function displayStories(posts) {
  const container = document.getElementById('storiesContainer');
  
  // Add user's story first
  const user = JSON.parse(localStorage.getItem('user'));
  let storiesHTML = `
    <div class="story-item" onclick="showSection('upload')">
      <div class="story-avatar">
        <div class="avatar-placeholder">${user.name.charAt(0).toUpperCase()}</div>
      </div>
      <div class="story-username">Your Story</div>
    </div>
  `;

  // Add other stories
  posts.slice(0, 8).forEach(post => {
    storiesHTML += `
      <div class="story-item" onclick="viewStory('${post._id || post.id}')">
        <div class="story-avatar">
          <div class="avatar-placeholder">${(post.userName || 'A').charAt(0).toUpperCase()}</div>
        </div>
        <div class="story-username">${post.userName || 'Anonymous'}</div>
      </div>
    `;
  });

  container.innerHTML = storiesHTML;
}

function viewStory(postId) {
  showSection('reels');
  // Could implement story viewer modal here
}

// ==========================================
// FEED
// ==========================================

async function loadFeed() {
  try {
    const response = await fetch(`${API_URL}/api/posts?status=open`);
    const data = await response.json();

    if (response.ok) {
      displayFeed(data.posts);
    }
  } catch (err) {
    console.error('Error loading feed:', err);
  }
}

function displayFeed(posts) {
  const container = document.getElementById('feedContainer');

  if (!posts || posts.length === 0) {
    container.innerHTML = `
      <div class="post-card" style="padding: 40px; text-align: center;">
        <i class="fas fa-camera" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 16px;"></i>
        <h3>No Posts Yet</h3>
        <p style="color: var(--text-secondary); margin-top: 12px;">Be the first to create a post</p>
        <button class="btn-primary" style="margin-top: 20px; max-width: 300px;" onclick="showSection('create')">Create Post</button>
      </div>
    `;
    return;
  }

  container.innerHTML = posts.map((post, index) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const isLiked = post.likes && post.likes.includes(user.id);
    
    return `
    <div class="post-card">
      <div class="post-header">
        <div class="post-avatar">${(post.userName || 'A').charAt(0).toUpperCase()}</div>
        <div class="post-user-info">
          <div class="post-username">${escapeHtml(post.userName || 'Anonymous')}</div>
          <div class="post-category">${formatCategory(post.category)}</div>
        </div>
      </div>

      ${post.images && post.images.length > 0 ? `
        <img src="${API_URL}${post.images[0]}" class="post-image" alt="${escapeHtml(post.title)}">
      ` : `
        <div style="width: 100%; height: 400px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem;">
          <i class="fas fa-briefcase"></i>
        </div>
      `}

      <div class="post-actions">
        <div class="post-actions-left">
          <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="likePost('${post._id || post.id}', this)">
            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
          </button>
          <button class="action-btn" onclick="toggleComments('${post._id || post.id}')">
            <i class="far fa-comment"></i>
          </button>
          <button class="action-btn" onclick="sharePost('${post._id || post.id}', '${post.title.replace(/'/g, "\\'")}')">
            <i class="far fa-paper-plane"></i>
          </button>
        </div>
        <button class="action-btn" onclick="toggleBookmark('${post._id || post.id}', this)">
          <i class="far fa-bookmark"></i>
        </button>
      </div>

      <div class="post-likes">${post.likes?.length || 0} likes</div>

      <div class="post-caption">
        <strong>${escapeHtml(post.userName || 'Anonymous')}</strong>
        ${escapeHtml(post.description)}
      </div>

      <div class="post-budget">💰 ${escapeHtml(post.budget)}</div>

      ${post.comments && post.comments.length > 0 ? `
        <div class="post-comments" onclick="toggleComments('${post._id || post.id}')">
          View all ${post.comments.length} comments
        </div>
      ` : ''}

      <div class="post-time">${formatDate(post.createdAt)}</div>

      <div class="post-contact">
        <a href="https://wa.me/${(post.userWhatsapp || post.userPhone || '').replace(/[^0-9]/g, '')}" target="_blank" class="contact-btn">
          <i class="fab fa-whatsapp"></i> Contact on WhatsApp
        </a>
        <span style="color: var(--text-secondary); font-size: 0.85rem;">
          <i class="fas fa-phone"></i> ${escapeHtml(post.userPhone || 'N/A')}
        </span>
      </div>
    </div>
  `;
  }).join('');
}

// ==========================================
// EXPLORE
// ==========================================

async function loadExplore() {
  try {
    const response = await fetch(`${API_URL}/api/posts`);
    const data = await response.json();

    if (response.ok) {
      displayExplore(data.posts);
    }
  } catch (err) {
    console.error('Error loading explore:', err);
  }
}

function displayExplore(posts) {
  const container = document.getElementById('exploreGrid');

  if (!posts || posts.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px;">No posts to explore</p>';
    return;
  }

  container.innerHTML = posts.map(post => `
    <div class="explore-item" onclick="showSection('feed')">
      ${post.images && post.images.length > 0 ? `
        <img src="${API_URL}${post.images[0]}" alt="${escapeHtml(post.title)}">
      ` : `
        <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem;">
          <i class="fas fa-briefcase"></i>
        </div>
      `}
      <div class="explore-overlay">
        <span><i class="fas fa-heart"></i> ${post.likes?.length || 0}</span>
        <span><i class="fas fa-comment"></i> ${post.comments?.length || 0}</span>
      </div>
    </div>
  `).join('');
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
        showSection('feed');
      }, 1000);
    } else {
      showAlert(data.error || 'Failed to create post');
    }
  } catch (err) {
    showAlert('Network error. Please try again.');
  }
});

// ==========================================
// PROFILE
// ==========================================

async function loadProfile() {
  try {
    const response = await fetch(`${API_URL}/api/posts/my`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      document.getElementById('profilePosts').textContent = data.posts?.length || 0;
      displayFeed(data.posts, 'profilePostsContainer');
    }
  } catch (err) {
    console.error('Error loading profile:', err);
  }
}

async function loadDashboard() {
  try {
    const response = await fetch(`${API_URL}/api/dashboard`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok && data.stats) {
      const user = JSON.parse(localStorage.getItem('user'));
      if (user.role === 'user') {
        document.getElementById('profilePosts').textContent = data.stats.myPosts || 0;
      }
    }
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

// ==========================================
// POST ACTIONS
// ==========================================

async function likePost(postId, button) {
  try {
    const response = await fetch(`${API_URL}/api/posts/${postId}/like`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      const icon = button.querySelector('i');
      if (data.liked) {
        button.classList.add('liked');
        icon.className = 'fas fa-heart';
      } else {
        button.classList.remove('liked');
        icon.className = 'far fa-heart';
      }
      
      // Update likes count
      const likesElement = button.closest('.post-card').querySelector('.post-likes');
      likesElement.textContent = `${data.likes} likes`;
    }
  } catch (err) {
    console.error('Error liking post:', err);
  }
}

function toggleComments(postId) {
  // Could implement comment modal/section here
  showAlert('Comments feature coming soon!', 'success');
}

// ==========================================
// LOGOUT
// ==========================================

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
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
// STATUS & SHORTS (REELS) FUNCTIONALITY
// ==========================================

// Upload Status or Shorts
document.getElementById('statusShortsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const type = document.getElementById('ssType').value;
  const caption = document.getElementById('ssCaption').value.trim();
  const media = document.getElementById('ssMedia').files[0];

  console.log('Upload attempt:', { type, caption, media: media?.name });

  if (!media) {
    showAlert('Please select a media file');
    return;
  }
  
  if (!type) {
    showAlert('Please select Status or Shorts');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('media', media);
    formData.append('type', type);
    if (caption) formData.append('caption', caption);

    const token = localStorage.getItem('token');
    console.log('Uploading to:', `${API_URL}/api/status-shorts/upload`);
    
    const response = await fetch(`${API_URL}/api/status-shorts/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();
    console.log('Upload response:', data);

    if (response.ok) {
      showAlert('Upload successful! 🎉', 'success');
      document.getElementById('statusShortsForm').reset();
      setTimeout(() => {
        showSection('reels');
      }, 1000);
    } else {
      showAlert(data.error || 'Upload failed');
    }
  } catch (err) {
    console.error('Upload error:', err);
    showAlert('Network error. Please try again.');
  }
});

// Load Reels (Status & Shorts) Feed
async function loadReelsFeed(type = 'all') {
  try {
    console.log('Loading reels feed...', type);
    let url = `${API_URL}/api/status-shorts/feed?tab=latest&limit=20`;
    if (type !== 'all') {
      url += `&type=${type}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (response.ok) {
      console.log('Reels loaded:', data.posts?.length || 0);
      displayReels(data.posts);
    } else {
      console.error('Failed to load reels:', data);
    }
  } catch (err) {
    console.error('Error loading reels:', err);
  }
}

// Display Reels
function displayReels(posts) {
  const container = document.getElementById('reelsContainer');

  if (!posts || posts.length === 0) {
    container.innerHTML = `
      <div class="post-card" style="padding: 40px; text-align: center;">
        <i class="fas fa-video" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 16px;"></i>
        <h3>No Reels Yet</h3>
        <p style="color: var(--text-secondary); margin-top: 12px;">Be the first to upload a status or short</p>
        <button class="btn-primary" style="margin-top: 20px; max-width: 300px;" onclick="showSection('upload')">Upload Now</button>
      </div>
    `;
    return;
  }

  container.innerHTML = posts.map((post, index) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const isLiked = post.likes && post.likes.includes(user.id);
    
    return `
    <div class="post-card" style="margin-bottom: 20px;">
      <div class="post-header">
        <div class="post-avatar">${(post.userName || 'A').charAt(0).toUpperCase()}</div>
        <div class="post-user-info">
          <div class="post-username">
            ${escapeHtml(post.userName || 'Anonymous')}
            <span class="type-badge ${post.type === 'status' ? 'badge-status' : 'badge-shorts'}">
              ${post.type === 'status' ? '⏰ Status' : '🎬 Shorts'}
            </span>
          </div>
          <div class="post-category">${post.mediaType === 'video' ? '📹 Video' : '🖼️ Image'}</div>
        </div>
      </div>

      ${post.mediaType === 'video' ? `
        <div class="video-container">
          <video src="${API_URL}${post.mediaUrl}" controls playsinline></video>
          <div class="video-actions">
            <button class="video-action-btn ${isLiked ? 'liked' : ''}" onclick="likeReel('${post._id || post.id}', this)">
              <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
            </button>
            <button class="video-action-btn" onclick="toggleReelComments('${post._id || post.id}')">
              <i class="far fa-comment"></i>
            </button>
            <button class="video-action-btn">
              <i class="far fa-paper-plane"></i>
            </button>
          </div>
          ${post.caption ? `
            <div class="video-overlay">
              <p><strong>${escapeHtml(post.userName || 'Anonymous')}</strong> ${escapeHtml(post.caption)}</p>
            </div>
          ` : ''}
        </div>
      ` : `
        <img src="${API_URL}${post.mediaUrl}" style="width: 100%; max-height: 600px; object-fit: contain;" alt="Media">
      `}

      <div class="post-actions">
        <div class="post-actions-left">
          <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="likeReel('${post._id || post.id}', this)">
            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
          </button>
          <button class="action-btn" onclick="toggleReelComments('${post._id || post.id}')">
            <i class="far fa-comment"></i>
          </button>
          <button class="action-btn" onclick="sharePost('${post._id || post.id}', '${(post.caption || 'Status/Shorts').replace(/'/g, "\\'")}')">
            <i class="far fa-paper-plane"></i>
          </button>
        </div>
        <button class="action-btn" onclick="toggleBookmark('${post._id || post.id}', this)">
          <i class="far fa-bookmark"></i>
        </button>
      </div>

      <div class="post-likes">${post.likes?.length || 0} likes</div>

      ${post.caption && post.mediaType === 'video' ? '' : `
        <div class="post-caption">
          <strong>${escapeHtml(post.userName || 'Anonymous')}</strong>
          ${escapeHtml(post.caption || '')}
        </div>
      `}

      <div style="padding: 0 14px; color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 8px;">
        <i class="fas fa-eye"></i> ${post.viewCount || 0} views
      </div>

      ${post.comments && post.comments.length > 0 ? `
        <div class="post-comments" onclick="toggleReelComments('${post._id || post.id}')">
          View all ${post.comments.length} comments
        </div>
      ` : ''}

      <div class="post-time">${formatDate(post.createdAt)}</div>

      <div id="reel-comments-${post._id || post.id}" class="comments-section" style="display: none;">
        <h4 style="margin-bottom: 12px; color: var(--ig-primary);">💬 Comments</h4>
        <div id="reel-comments-list-${post._id || post.id}">
          ${(post.comments || []).map(comment => `
            <div class="comment-item">
              <strong>${escapeHtml(comment.userName)}</strong>
              <small style="float: right;">${formatDate(comment.timestamp)}</small>
              <p>${escapeHtml(comment.text)}</p>
            </div>
          `).join('')}
        </div>
        <div style="margin-top: 12px; display: flex; gap: 8px;">
          <input type="text" id="reel-comment-input-${post._id || post.id}" placeholder="Add a comment..." 
            style="flex: 1; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px;">
          <button class="btn-primary" onclick="addReelComment('${post._id || post.id}')" style="padding: 8px 16px; width: auto;">Post</button>
        </div>
      </div>

      ${post.type === 'status' ? `
        <div style="padding: 12px 14px; background: #fff3f3; border-top: 1px solid var(--border-color); color: #ed4956; font-size: 0.85rem; font-weight: 600; text-align: center;">
          ⏰ This status expires in 24 hours
        </div>
      ` : ''}
    </div>
  `;
  }).join('');

  // Track views for videos
  container.querySelectorAll('video').forEach((video, idx) => {
    video.addEventListener('play', () => {
      const postId = posts[idx]._id || posts[idx].id;
      trackReelView(postId);
    });
  });
}

// Like Reel
async function likeReel(postId, button) {
  try {
    const response = await fetch(`${API_URL}/api/status-shorts/${postId}/like`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      const icon = button.querySelector('i');
      if (data.liked) {
        button.classList.add('liked');
        icon.className = 'fas fa-heart';
      } else {
        button.classList.remove('liked');
        icon.className = 'far fa-heart';
      }
      
      // Update likes count
      const reelCard = button.closest('.post-card');
      const likesElement = reelCard.querySelector('.post-likes');
      if (likesElement) {
        likesElement.textContent = `${data.likes} likes`;
      }
    }
  } catch (err) {
    console.error('Error liking reel:', err);
  }
}

// Toggle Reel Comments
function toggleReelComments(postId) {
  const commentsSection = document.getElementById(`reel-comments-${postId}`);
  if (commentsSection) {
    if (commentsSection.style.display === 'none') {
      commentsSection.style.display = 'block';
    } else {
      commentsSection.style.display = 'none';
    }
  }
}

// Add Reel Comment
async function addReelComment(postId) {
  const input = document.getElementById(`reel-comment-input-${postId}`);
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
      
      // Refresh the reels feed to show new comment
      loadReelsFeed();
    } else {
      showAlert(data.error || 'Failed to add comment');
    }
  } catch (err) {
    showAlert('Network error. Please try again.');
  }
}

// Track Reel View
function trackReelView(postId) {
  fetch(`${API_URL}/api/status-shorts/${postId}/view`, {
    method: 'POST',
    headers: getAuthHeaders()
  }).catch(err => console.error('Error tracking view:', err));
}

// ==========================================
// FOLLOW/SUBSCRIBE FUNCTIONALITY
// ==========================================

// Follow/Unfollow a user
async function followUser(userId, button) {
  try {
    const response = await fetch(`${API_URL}/api/users/${userId}/follow`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      if (data.following) {
        button.textContent = 'Unfollow';
        button.classList.add('following');
        showAlert('User followed! ✓', 'success');
      } else {
        button.textContent = 'Follow';
        button.classList.remove('following');
        showAlert('User unfollowed', 'success');
      }
      
      // Update counts if displayed
      const followersElement = document.getElementById('profileFollowers');
      if (followersElement && data.followers !== undefined) {
        followersElement.textContent = data.followers;
      }
    } else {
      showAlert(data.error || 'Failed to follow user');
    }
  } catch (err) {
    showAlert('Network error. Please try again.');
  }
}

// Check if following a user
async function checkFollowStatus(userId, button) {
  try {
    const response = await fetch(`${API_URL}/api/users/${userId}/follow-status`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      if (data.following) {
        button.textContent = 'Unfollow';
        button.classList.add('following');
      } else {
        button.textContent = 'Follow';
        button.classList.remove('following');
      }
    }
  } catch (err) {
    console.error('Error checking follow status:', err);
  }
}

// Load followers
async function loadFollowers(userId) {
  try {
    const response = await fetch(`${API_URL}/api/users/${userId}/followers`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      return data.followers;
    }
  } catch (err) {
    console.error('Error loading followers:', err);
  }
  return [];
}

// Load following
async function loadFollowing(userId) {
  try {
    const response = await fetch(`${API_URL}/api/users/${userId}/following`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      return data.following;
    }
  } catch (err) {
    console.error('Error loading following:', err);
  }
  return [];
}

// ==========================================
// ADVANCED FEATURES
// ==========================================

// Show Notifications Panel
function showNotifications() {
  // Create notifications modal if it doesn't exist
  let modal = document.getElementById('notificationsModal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'notificationsModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px; max-height: 80vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0;">🔔 Notifications</h2>
          <button onclick="closeNotifications()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>
        <button onclick="markAllNotificationsAsRead()" style="margin-bottom: 16px; padding: 8px 16px; background: var(--ig-gradient); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
          Mark All as Read
        </button>
        <div id="notificationsList"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  // Show modal
  modal.style.display = 'flex';
  
  // Load notifications
  loadAndDisplayNotifications();
}

// Close Notifications
function closeNotifications() {
  const modal = document.getElementById('notificationsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Load and Display Notifications
async function loadAndDisplayNotifications() {
  const data = await loadNotifications();
  const list = document.getElementById('notificationsList');
  
  if (!list) return;
  
  if (data.notifications && data.notifications.length > 0) {
    list.innerHTML = data.notifications.map(notification => `
      <div style="padding: 12px; border-bottom: 1px solid var(--border-color); ${notification.isRead ? '' : 'background: rgba(64, 93, 230, 0.05);'}">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <p style="margin: 0 0 4px 0; font-size: 0.9rem;">${notification.message}</p>
            <small style="color: var(--text-secondary);">${formatDate(notification.createdAt)}</small>
          </div>
          ${!notification.isRead ? '<span style="width: 8px; height: 8px; background: var(--ig-primary); border-radius: 50%; display: inline-block;"></span>' : ''}
        </div>
      </div>
    `).join('');
  } else {
    list.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 40px 0;">No notifications yet</p>';
  }
}

// Share Post Function - CLIENT SIDE ONLY (No API calls)
function sharePost(postId, postTitle) {
  try {
    const shareUrl = `${window.location.origin}/?post=${postId}`;
    const shareText = `Check out this post: ${postTitle} on GigHub`;

    // Check if Web Share API is available
    if (navigator.share) {
      navigator.share({
        title: postTitle,
        text: shareText,
        url: shareUrl
      })
      .then(() => {
        console.log('✓ Post shared successfully');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.log('Share cancelled, using fallback');
          fallbackShare(shareUrl);
        }
      });
    } else {
      // Web Share API not available, use fallback
      fallbackShare(shareUrl);
    }
  } catch (error) {
    console.error('Share error:', error);
    // Final fallback - just show the URL
    const shareUrl = `${window.location.origin}/?post=${postId}`;
    prompt('Copy this link to share:', shareUrl);
  }
}

// Fallback share method (copy to clipboard) - CLIENT SIDE ONLY
function fallbackShare(url) {
  try {
    // Try clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        showAlert('✓ Link copied to clipboard!', 'success');
      }).catch((err) => {
        console.log('Clipboard API failed, using prompt fallback');
        prompt('Copy this link to share:', url);
      });
    } else {
      // Clipboard API not available, use prompt
      prompt('Copy this link to share:', url);
    }
  } catch (error) {
    console.error('Fallback share error:', error);
    prompt('Copy this link to share:', url);
  }
}

// Toggle Bookmark
async function toggleBookmark(postId, button) {
  try {
    const response = await fetch(`${API_URL}/api/bookmarks/${postId}/toggle`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      const icon = button.querySelector('i');
      if (data.bookmarked) {
        button.classList.add('bookmarked');
        icon.className = 'fas fa-bookmark';
        showAlert('Post bookmarked!', 'success');
      } else {
        button.classList.remove('bookmarked');
        icon.className = 'far fa-bookmark';
        showAlert('Bookmark removed', 'success');
      }
    } else {
      showAlert(data.error || 'Failed to bookmark post');
    }
  } catch (err) {
    console.error('Bookmark error:', err);
    showAlert('Network error. Please try again.');
  }
}

// Check Bookmark Status
async function checkBookmarkStatus(postId, button) {
  try {
    const response = await fetch(`${API_URL}/api/bookmarks/${postId}/status`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      const icon = button.querySelector('i');
      if (data.bookmarked) {
        button.classList.add('bookmarked');
        icon.className = 'fas fa-bookmark';
      } else {
        button.classList.remove('bookmarked');
        icon.className = 'far fa-bookmark';
      }
    }
  } catch (err) {
    console.error('Error checking bookmark status:', err);
  }
}

// Load Notifications
async function loadNotifications(unreadOnly = false) {
  try {
    const response = await fetch(`${API_URL}/api/notifications?unreadOnly=${unreadOnly}`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      return data;
    }
  } catch (err) {
    console.error('Error loading notifications:', err);
  }
  return { notifications: [], unreadCount: 0 };
}

// Get Unread Notification Count
async function getUnreadNotificationCount() {
  try {
    const response = await fetch(`${API_URL}/api/notifications/unread-count`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      return data.count;
    }
  } catch (err) {
    console.error('Error getting notification count:', err);
  }
  return 0;
}

// Mark Notification as Read
async function markNotificationAsRead(notificationId) {
  try {
    const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });

    return response.ok;
  } catch (err) {
    console.error('Error marking notification as read:', err);
    return false;
  }
}

// Mark All Notifications as Read
async function markAllNotificationsAsRead() {
  try {
    const response = await fetch(`${API_URL}/api/notifications/read-all`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });

    if (response.ok) {
      showAlert('All notifications marked as read', 'success');
      updateNotificationBadge();
    }
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
  }
}

// Update Notification Badge
async function updateNotificationBadge() {
  const count = await getUnreadNotificationCount();
  const badge = document.getElementById('notificationBadge');
  
  if (badge) {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

// Dark Mode Toggle
function toggleDarkMode() {
  const body = document.body;
  const isDark = body.classList.toggle('dark-mode');
  
  // Save preference
  localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
  
  // Update icon
  const darkModeIcon = document.getElementById('darkModeIcon');
  if (darkModeIcon) {
    darkModeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
  }
  
  showAlert(isDark ? 'Dark mode enabled 🌙' : 'Light mode enabled ☀️', 'success');
}

// Load Dark Mode Preference
function loadDarkModePreference() {
  const darkMode = localStorage.getItem('darkMode');
  const body = document.body;
  
  if (darkMode === 'enabled') {
    body.classList.add('dark-mode');
  }
  
  // Update icon
  const darkModeIcon = document.getElementById('darkModeIcon');
  if (darkModeIcon) {
    darkModeIcon.className = darkMode === 'enabled' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

// Load User Analytics
async function loadUserAnalytics() {
  try {
    const response = await fetch(`${API_URL}/api/analytics/user`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      return data.analytics;
    }
  } catch (err) {
    console.error('Error loading analytics:', err);
  }
  return null;
}

// Search Posts
async function searchPosts(query, filters = {}) {
  try {
    const params = new URLSearchParams({ query, ...filters });
    const response = await fetch(`${API_URL}/api/search/posts?${params}`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      return data;
    }
  } catch (err) {
    console.error('Error searching posts:', err);
  }
  return { posts: [], pagination: {} };
}

// Get Trending Posts
async function getTrendingPosts(limit = 10) {
  try {
    const response = await fetch(`${API_URL}/api/search/trending?limit=${limit}`);

    const data = await response.json();

    if (response.ok) {
      return data.posts;
    }
  } catch (err) {
    console.error('Error getting trending posts:', err);
  }
  return [];
}

// Load dark mode preference on page load
document.addEventListener('DOMContentLoaded', () => {
  loadDarkModePreference();
  updateNotificationBadge();
});


