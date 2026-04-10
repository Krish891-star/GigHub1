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
        updateNotificationBadge(); // Update notification badge on load
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

    // Update bottom nav only (top nav no longer has navigation icons)
    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
    bottomNavItems.forEach(item => item.classList.remove('active'));

    // Map section names to bottom navigation indices
    const bottomIconMap = {
      'feed': 0,
      'explore': 1,
      'create': 2,
      'creators': 3,
      'profile': 4
    };

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
        loadStories();
        break;
      case 'explore':
        loadExplore();
        break;
      case 'creators':
        loadCreators();
        break;
      case 'profile':
        loadProfile();
        break;
      case 'create':
        console.log('Create post section ready');
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

let allStories = [];
let currentStoryUserIndex = 0;
let currentStoryIndex = 0;

async function loadStories() {
  try {
    console.log('Loading stories...');
    const response = await fetch(`${API_URL}/api/status-shorts/stories`);
    const data = await response.json();

    console.log('Stories response:', response.status, data);

    if (response.ok && data.stories) {
      allStories = data.stories;
      displayStories(data.stories);
      console.log('Stories loaded:', data.stories.length);
    } else {
      console.error('Failed to load stories:', data);
      // Still display "Your Story" even if API fails
      displayStories([]);
    }
  } catch (err) {
    console.error('Error loading stories:', err);
    // Still display "Your Story" even if error
    displayStories([]);
  }
}

function displayStories(stories) {
  const container = document.getElementById('storiesContainer');
  if (!container) {
    console.error('Stories container not found!');
    return;
  }
  
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) {
    console.error('User not found in localStorage');
    return;
  }
  
  console.log('Displaying stories for user:', user.name);
  
  let storiesHTML = `
    <div class="story-item" onclick="openStoryUploadModal()">
      <div class="story-avatar your-story">
        <div class="avatar-placeholder">${user.name.charAt(0).toUpperCase()}</div>
        <div class="add-story-icon">+</div>
      </div>
      <div class="story-username">Your Story</div>
    </div>
  `;

  // Add other users' stories
  if (stories && stories.length > 0) {
    stories.forEach((storyGroup, index) => {
      // Skip if it's the current user's story
      if (storyGroup.userId === user.id) return;
      
      storiesHTML += `
        <div class="story-item" onclick="viewStoryGroup(${index})">
          <div class="story-avatar has-story">
            <div class="avatar-placeholder">${(storyGroup.userName || 'A').charAt(0).toUpperCase()}</div>
          </div>
          <div class="story-username">${storyGroup.userName || 'Anonymous'}</div>
        </div>
      `;
    });
  }

  container.innerHTML = storiesHTML;
  console.log('Stories HTML rendered');
}

// Open story upload modal
function openStoryUploadModal() {
  document.getElementById('storyUploadModal').style.display = 'flex';
}

// Close story upload modal
function closeStoryUploadModal() {
  document.getElementById('storyUploadModal').style.display = 'none';
  document.getElementById('storyUploadForm').reset();
}

// Story upload form handler
document.getElementById('storyUploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const media = document.getElementById('storyMedia').files[0];
  const caption = document.getElementById('storyCaption').value.trim();
  const token = localStorage.getItem('token');
  
  if (!media) {
    showAlert('Please select a photo or video');
    return;
  }
  
  const formData = new FormData();
  formData.append('media', media);
  if (caption) formData.append('caption', caption);
  
  try {
    const response = await fetch(`${API_URL}/api/status-shorts/story`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('Story added successfully! 🎉', 'success');
      closeStoryUploadModal();
      loadStories(); // Refresh stories
    } else {
      showAlert(data.error || 'Failed to upload story');
    }
  } catch (err) {
    console.error('Story upload error:', err);
    showAlert('Network error. Please try again.');
  }
});

// View story group (all stories from one user)
function viewStoryGroup(userIndex) {
  currentStoryUserIndex = userIndex;
  currentStoryIndex = 0;
  showStory();
}

// Show current story
function showStory() {
  const userStoryGroup = allStories[currentStoryUserIndex];
  if (!userStoryGroup || !userStoryGroup.stories || userStoryGroup.stories.length === 0) {
    closeStoryViewer();
    return;
  }
  
  const story = userStoryGroup.stories[currentStoryIndex];
  const modal = document.getElementById('storyViewerModal');
  
  // Update viewer info
  document.getElementById('storyViewerAvatar').textContent = (userStoryGroup.userName || 'U').charAt(0).toUpperCase();
  document.getElementById('storyViewerUsername').textContent = userStoryGroup.userName || 'Anonymous';
  
  const timeAgo = getTimeAgo(new Date(story.createdAt));
  document.getElementById('storyViewerTime').textContent = timeAgo;
  
  // Display media
  const mediaContainer = document.getElementById('storyViewerMedia');
  if (story.mediaType === 'video') {
    mediaContainer.innerHTML = `
      <video src="${API_URL}${story.mediaUrl}" autoplay controls style="width: 100%; max-height: 80vh; object-fit: contain; background: black;"></video>
    `;
  } else {
    mediaContainer.innerHTML = `
      <img src="${API_URL}${story.mediaUrl}" alt="Story" style="width: 100%; max-height: 80vh; object-fit: contain;">
    `;
  }
  
  // Display caption
  const captionEl = document.getElementById('storyViewerCaption');
  if (story.caption) {
    captionEl.textContent = story.caption;
    captionEl.style.display = 'block';
  } else {
    captionEl.style.display = 'none';
  }
  
  // Show modal
  modal.style.display = 'flex';
  
  // Track view
  trackStoryView(story._id || story.id);
}

// Close story viewer
function closeStoryViewer() {
  document.getElementById('storyViewerModal').style.display = 'none';
  document.getElementById('storyViewerMedia').innerHTML = '';
}

// Next story
function nextStory() {
  const userStoryGroup = allStories[currentStoryUserIndex];
  if (!userStoryGroup) return;
  
  if (currentStoryIndex < userStoryGroup.stories.length - 1) {
    currentStoryIndex++;
    showStory();
  } else if (currentStoryUserIndex < allStories.length - 1) {
    // Move to next user's stories
    currentStoryUserIndex++;
    currentStoryIndex = 0;
    showStory();
  } else {
    closeStoryViewer();
  }
}

// Previous story
function previousStory() {
  if (currentStoryIndex > 0) {
    currentStoryIndex--;
    showStory();
  } else if (currentStoryUserIndex > 0) {
    currentStoryUserIndex--;
    const prevUserGroup = allStories[currentStoryUserIndex];
    if (prevUserGroup && prevUserGroup.stories) {
      currentStoryIndex = prevUserGroup.stories.length - 1;
      showStory();
    }
  }
}

// Track story view
async function trackStoryView(storyId) {
  try {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/api/status-shorts/${storyId}/view`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (err) {
    console.error('Error tracking story view:', err);
  }
}

// Helper function to get time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = Math.floor(seconds / 3600);
  if (interval >= 1) {
    return interval + 'h ago';
  }
  interval = Math.floor(seconds / 60);
  if (interval >= 1) {
    return interval + 'm ago';
  }
  return 'Just now';
}

function viewStory(postId) {
  showSection('reels');
  // Could implement story viewer modal here
}

// ==========================================
// CREATORS DIRECTORY
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
    container.innerHTML = `
      <div class="post-card" style="padding: 40px; text-align: center;">
        <i class="fas fa-users" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 16px;"></i>
        <h3>No Creators Yet</h3>
        <p style="color: var(--text-secondary); margin-top: 12px;">Be the first to register as a creator</p>
      </div>
    `;
    return;
  }

  container.innerHTML = creators.map(creator => {
    const user = JSON.parse(localStorage.getItem('user'));
    const isFollowing = creator.followers && creator.followers.includes(user.id);
    
    return `
    <div class="post-card" style="cursor: pointer;" onclick="viewCreatorProfile('${creator._id || creator.id}')">
      <div class="post-header">
        <div class="post-avatar" style="background: var(--ig-gradient);">${(creator.name || 'C').charAt(0).toUpperCase()}</div>
        <div class="post-user-info">
          <div class="post-username">${escapeHtml(creator.name || 'Creator')}</div>
          <div class="post-category"><i class="fas fa-palette"></i> ${escapeHtml(creator.skills && creator.skills.length > 0 ? creator.skills.slice(0, 3).join(', ') : 'Creator')}</div>
        </div>
      </div>

      ${creator.bio ? `
        <div class="post-caption">
          ${escapeHtml(creator.bio)}
        </div>
      ` : ''}

      ${creator.skills && creator.skills.length > 0 ? `
        <div style="padding: 0 16px 12px; display: flex; flex-wrap: wrap; gap: 8px;">
          ${creator.skills.slice(0, 5).map(skill => `
            <span style="background: var(--ig-gradient); color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">
              ${escapeHtml(skill)}
            </span>
          `).join('')}
        </div>
      ` : ''}

      <div style="padding: 12px 16px; display: flex; gap: 12px; border-top: 1px solid var(--border-color);">
        <button class="follow-btn ${isFollowing ? 'following' : ''}" onclick="event.stopPropagation(); followUser('${creator._id || creator.id}', this)">
          ${isFollowing ? '<i class="fas fa-check"></i> Following' : '<i class="fas fa-user-plus"></i> Follow'}
        </button>
        ${creator.whatsapp ? `
          <a href="https://wa.me/${creator.whatsapp.replace(/[^0-9]/g, '')}" target="_blank" onclick="event.stopPropagation();" class="contact-btn" style="flex: 1; text-align: center; text-decoration: none;">
            <i class="fab fa-whatsapp"></i> Contact
          </a>
        ` : ''}
      </div>

      <div class="post-time">
        <i class="fas fa-star"></i> ${creator.rating || 0} rating · ${creator.completedProjects || 0} projects
      </div>
    </div>
  `;
  }).join('');
}

// View Creator Profile (Full Details)
async function viewCreatorProfile(creatorId) {
  try {
    console.log('Loading creator profile:', creatorId);
    
    // Fetch creator details
    const response = await fetch(`${API_URL}/api/creators/${creatorId}`);
    const data = await response.json();

    if (!response.ok || !data.creator) {
      showAlert('Creator not found');
      return;
    }

    const creator = data.creator;
    
    // Check if creator has any status/stories
    let statusHTML = '';
    try {
      const statusResponse = await fetch(`${API_URL}/api/status-shorts/stories`);
      const statusData = await statusResponse.json();
      
      if (statusData.stories && statusData.stories.length > 0) {
        const userStories = statusData.stories.find(s => s.userId === creatorId);
        if (userStories && userStories.stories && userStories.stories.length > 0) {
          statusHTML = `
            <div style="background: var(--ig-gradient); color: white; padding: 16px; border-radius: 12px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; cursor: pointer;" onclick="viewCreatorStories('${creatorId}')">
              <i class="fas fa-clock" style="font-size: 1.5rem;"></i>
              <div>
                <div style="font-weight: 700;">Active Status Available</div>
                <div style="font-size: 0.85rem; opacity: 0.9;">Tap to view ${userStories.stories.length} status update(s)</div>
              </div>
            </div>
          `;
        }
      }
    } catch (err) {
      console.error('Error checking status:', err);
    }

    // Build profile HTML
    const currentUser = JSON.parse(localStorage.getItem('user'));
    const isFollowing = creator.followers && creator.followers.includes(currentUser.id);

    const profileHTML = `
      <div class="post-card" style="padding: 24px;">
        <!-- Header -->
        <div style="display: flex; gap: 24px; align-items: start; margin-bottom: 24px;">
          <div style="width: 100px; height: 100px; border-radius: 50%; background: var(--ig-gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 2.5rem; font-weight: 700; flex-shrink: 0;">
            ${(creator.name || 'C').charAt(0).toUpperCase()}
          </div>
          <div style="flex: 1;">
            <h2 style="margin: 0 0 8px 0;">${escapeHtml(creator.name || 'Creator')}</h2>
            ${creator.tagline ? `<div style="color: var(--ig-primary); font-weight: 600; margin-bottom: 8px;">${escapeHtml(creator.tagline)}</div>` : ''}
            ${creator.availability ? `
              <div style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; background: ${creator.availability === 'available' ? '#4ade80' : creator.availability === 'busy' ? '#fbbf24' : '#ef4444'}; color: white;">
                <i class="fas fa-circle" style="font-size: 0.5rem; margin-right: 4px;"></i> ${creator.availability === 'available' ? 'Available' : creator.availability === 'busy' ? 'Busy' : 'Not Available'}
              </div>
            ` : ''}
          </div>
        </div>

        ${statusHTML}

        <!-- Stats -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
          <div style="text-align: center; padding: 12px; background: var(--bg-primary); border-radius: 8px;">
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--ig-primary);">${creator.followers?.length || 0}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Followers</div>
          </div>
          <div style="text-align: center; padding: 12px; background: var(--bg-primary); border-radius: 8px;">
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--ig-primary);">${creator.following?.length || 0}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Following</div>
          </div>
          <div style="text-align: center; padding: 12px; background: var(--bg-primary); border-radius: 8px;">
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--ig-primary);">${creator.completedProjects || 0}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Projects</div>
          </div>
          <div style="text-align: center; padding: 12px; background: var(--bg-primary); border-radius: 8px;">
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--ig-primary);">⭐ ${creator.rating || 0}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Rating</div>
          </div>
        </div>

        <!-- Bio -->
        ${creator.bio ? `
          <div style="margin-bottom: 20px;">
            <h3 style="margin-bottom: 8px;"><i class="fas fa-user"></i> About</h3>
            <p style="line-height: 1.6; color: var(--text-secondary);">${escapeHtml(creator.bio)}</p>
          </div>
        ` : ''}

        <!-- Skills -->
        ${creator.skills && creator.skills.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="margin-bottom: 12px;"><i class="fas fa-tools"></i> Skills</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${creator.skills.map(skill => `
                <span style="background: var(--ig-gradient); color: white; padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">
                  ${escapeHtml(skill)}
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Service Categories -->
        ${creator.serviceCategories && creator.serviceCategories.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="margin-bottom: 12px;"><i class="fas fa-briefcase"></i> Services</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${creator.serviceCategories.map(service => `
                <span style="background: var(--bg-primary); color: var(--text-primary); padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; border: 1px solid var(--border-color);">
                  ${escapeHtml(service)}
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Experience -->
        ${creator.experience && creator.experience.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="margin-bottom: 12px;"><i class="fas fa-briefcase"></i> Experience</h3>
            ${creator.experience.map(exp => `
              <div style="padding: 12px; background: var(--bg-primary); border-radius: 8px; margin-bottom: 8px;">
                <div style="font-weight: 600;">${escapeHtml(exp.title)}</div>
                <div style="color: var(--ig-primary); font-size: 0.9rem;">${escapeHtml(exp.company)}</div>
                <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">${escapeHtml(exp.duration)}</div>
                ${exp.description ? `<div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 8px; line-height: 1.5;">${escapeHtml(exp.description)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Education -->
        ${creator.education && creator.education.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="margin-bottom: 12px;"><i class="fas fa-graduation-cap"></i> Education</h3>
            ${creator.education.map(edu => `
              <div style="padding: 12px; background: var(--bg-primary); border-radius: 8px; margin-bottom: 8px;">
                <div style="font-weight: 600;">${escapeHtml(edu.degree)}</div>
                <div style="color: var(--ig-primary); font-size: 0.9rem;">${escapeHtml(edu.institution)}</div>
                <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 4px;">${escapeHtml(edu.year)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- Languages -->
        ${creator.languages && creator.languages.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="margin-bottom: 12px;"><i class="fas fa-language"></i> Languages</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${creator.languages.map(lang => `
                <span style="background: var(--bg-primary); color: var(--text-primary); padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; border: 1px solid var(--border-color);">
                  ${escapeHtml(lang)}
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Contact Info -->
        <div style="display: flex; gap: 12px; padding-top: 20px; border-top: 1px solid var(--border-color);">
          <button class="follow-btn ${isFollowing ? 'following' : ''}" onclick="followUser('${creator._id || creator.id}', this)" style="flex: 1;">
            ${isFollowing ? '<i class="fas fa-check"></i> Following' : '<i class="fas fa-user-plus"></i> Follow'}
          </button>
          ${creator.whatsapp ? `
            <a href="https://wa.me/${creator.whatsapp.replace(/[^0-9]/g, '')}" target="_blank" class="contact-btn" style="flex: 1; text-align: center; text-decoration: none;">
              <i class="fab fa-whatsapp"></i> WhatsApp
            </a>
          ` : ''}
        </div>
      </div>
    `;

    // Show profile in a modal
    showCreatorProfileModal(profileHTML);
    
  } catch (err) {
    console.error('Error loading creator profile:', err);
    showAlert('Error loading creator profile');
  }
}

// Show creator profile modal
function showCreatorProfileModal(content) {
  let modal = document.getElementById('creatorProfileModal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'creatorProfileModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; position: sticky; top: 0; background: var(--bg-secondary); padding: 12px; z-index: 10;">
          <h2 style="margin: 0;"><i class="fas fa-user"></i> Creator Profile</h2>
          <button onclick="closeCreatorProfileModal()" style="background: none; border: none; font-size: 1.8rem; cursor: pointer; color: var(--text-primary);">&times;</button>
        </div>
        <div id="creatorProfileContent"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('creatorProfileContent').innerHTML = content;
  modal.style.display = 'flex';
}

// Close creator profile modal
function closeCreatorProfileModal() {
  const modal = document.getElementById('creatorProfileModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// View creator stories/status
function viewCreatorStories(creatorId) {
  // Find the creator's stories in allStories
  const userIndex = allStories.findIndex(s => s.userId === creatorId);
  if (userIndex >= 0) {
    currentStoryUserIndex = userIndex;
    currentStoryIndex = 0;
    showStory();
  } else {
    showAlert('No status available');
  }
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
    
    // CRITICAL FIX: Provide defaults for old posts that don't have new fields
    const postType = post.postType || 'post';
    const videoUrl = post.videoUrl || '';
    const mediaType = post.mediaType || 'image';
    const caption = post.caption || '';
    
    // Determine media display based on post type
    let mediaHTML = '';
    if (postType === 'post') {
      // Traditional post with images
      if (post.images && post.images.length > 0) {
        mediaHTML = `<img src="${API_URL}${post.images[0]}" class="post-image" alt="${escapeHtml(post.title || 'Post')}">`;
      } else {
        mediaHTML = `
          <div style="width: 100%; height: 400px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-size: 3rem;">
            <i class="fas fa-briefcase"></i>
          </div>
        `;
      }
    } else if (postType === 'reel' || postType === 'short' || postType === 'video') {
      // Video post
      if (videoUrl) {
        mediaHTML = `
          <video src="${API_URL}${videoUrl}" class="post-video" controls preload="metadata" style="width: 100%; max-height: 600px; background: black;"></video>
        `;
      } else if (post.images && post.images.length > 0) {
        mediaHTML = `<img src="${API_URL}${post.images[0]}" class="post-image" alt="${escapeHtml(post.title || caption || 'Post')}">`;
      }
    }
    
    // Determine caption/description
    let captionHTML = '';
    if (postType === 'post') {
      captionHTML = `
        <div class="post-caption">
          <strong>${escapeHtml(post.userName || 'Anonymous')}</strong>
          ${escapeHtml(post.description || '')}
        </div>
      `;
      // Show budget only if it exists
      if (post.budget) {
        captionHTML += `<div class="post-budget">💰 ${escapeHtml(post.budget)}</div>`;
      }
    } else {
      // Reel/Short/Video with caption
      if (caption || post.description) {
        captionHTML = `
          <div class="post-caption">
            <strong>${escapeHtml(post.userName || 'Anonymous')}</strong>
            ${escapeHtml(caption || post.description || '')}
          </div>
        `;
      }
    }
    
    // Post type badge
    let badgeHTML = '';
    if (postType !== 'post') {
      const badgeIcon = postType === 'reel' ? 'fa-film' : postType === 'short' ? 'fa-video' : 'fa-play-circle';
      const badgeLabel = postType.charAt(0).toUpperCase() + postType.slice(1);
      badgeHTML = `<div class="post-type-badge"><i class="fas ${badgeIcon}"></i> ${badgeLabel}</div>`;
    }
    
    // Follow button (only if viewing someone else's post)
    let followButtonHTML = '';
    if (post.userId && post.userId !== user.id && user.id) {
      followButtonHTML = `
        <button class="follow-btn" onclick="followUser('${post.userId}', this)" style="margin-left: auto; padding: 4px 12px; font-size: 0.8rem;">
          <i class="fas fa-user-plus"></i> Follow
        </button>
      `;
    }
    
    // WhatsApp contact (only for traditional posts)
    let contactHTML = '';
    if (postType === 'post' && (post.userWhatsapp || post.userPhone)) {
      contactHTML = `
        <div class="post-contact">
          <a href="https://wa.me/${(post.userWhatsapp || post.userPhone || '').replace(/[^0-9]/g, '')}" target="_blank" class="contact-btn">
            <i class="fab fa-whatsapp"></i> Contact on WhatsApp
          </a>
          <span style="color: var(--text-secondary); font-size: 0.85rem;">
            <i class="fas fa-phone"></i> ${escapeHtml(post.userPhone || 'N/A')}
          </span>
        </div>
      `;
    }
    
    return `
    <div class="post-card">
      <div class="post-header">
        <div class="post-avatar">${(post.userName || 'A').charAt(0).toUpperCase()}</div>
        <div class="post-user-info" style="flex: 1;">
          <div class="post-username">${escapeHtml(post.userName || 'Anonymous')}</div>
          <div class="post-category">${postType === 'post' ? formatCategory(post.category) : badgeHTML}</div>
        </div>
        ${followButtonHTML}
      </div>

      ${mediaHTML}

      <div class="post-actions">
        <div class="post-actions-left">
          <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="likePost('${post._id || post.id}', this)">
            <i class="${isLiked ? 'fas' : 'far'} fa-heart"></i>
          </button>
          <button class="action-btn" onclick="toggleComments('${post._id || post.id}')">
            <i class="far fa-comment"></i>
          </button>
          <button class="action-btn" onclick="sharePost('${post._id || post.id}', '${(post.title || caption || '').replace(/'/g, "\\'")}')">
            <i class="far fa-paper-plane"></i>
          </button>
        </div>
        <button class="action-btn" onclick="toggleBookmark('${post._id || post.id}', this)">
          <i class="far fa-bookmark"></i>
        </button>
      </div>

      <div class="post-likes">${post.likes?.length || 0} likes</div>

      ${captionHTML}

      ${post.comments && post.comments.length > 0 ? `
        <div class="post-comments" onclick="toggleComments('${post._id || post.id}')">
          View all ${post.comments.length} comments
        </div>
      ` : ''}

      <div class="post-time">${formatDate(post.createdAt)}</div>

      ${contactHTML}
    </div>
  `;
  }).join('');
}

// ==========================================
// EXPLORE (SEARCH ONLY)
// ==========================================

let currentSearchType = 'posts';

// Load explore - now just shows search interface
function loadExplore() {
  // Don't load anything automatically, user must search
  console.log('Explore section ready for search');
  
  // Initialize search tabs
  const postsTab = document.getElementById('searchPostsTab');
  if (postsTab) {
    postsTab.style.background = 'var(--ig-gradient)';
    postsTab.style.color = 'white';
    postsTab.style.borderColor = 'transparent';
  }
  
  // Clear search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
  }
  
  // Reset to default message
  const searchResults = document.getElementById('searchResults');
  if (searchResults) {
    searchResults.style.display = 'block';
    searchResults.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
        <i class="fas fa-search" style="font-size: 4rem; margin-bottom: 16px; opacity: 0.3;"></i>
        <h3 style="margin-bottom: 8px;">Search GigHub</h3>
        <p>Find posts, creators, and more</p>
      </div>
    `;
  }
  
  // Hide results containers
  const postsResults = document.getElementById('postsSearchResults');
  const creatorsResults = document.getElementById('creatorsSearchResults');
  if (postsResults) postsResults.style.display = 'none';
  if (creatorsResults) creatorsResults.style.display = 'none';
}

// Set search type (posts or creators)
function setSearchType(type) {
  currentSearchType = type;
  
  // Update tab styles
  const postsTab = document.getElementById('searchPostsTab');
  const creatorsTab = document.getElementById('searchCreatorsTab');
  
  if (type === 'posts') {
    postsTab.classList.add('active');
    postsTab.style.background = 'var(--ig-gradient)';
    postsTab.style.color = 'white';
    postsTab.style.borderColor = 'transparent';
    
    creatorsTab.classList.remove('active');
    creatorsTab.style.background = 'var(--bg-secondary)';
    creatorsTab.style.color = 'var(--text-primary)';
    creatorsTab.style.borderColor = 'var(--border-color)';
  } else {
    creatorsTab.classList.add('active');
    creatorsTab.style.background = 'var(--ig-gradient)';
    creatorsTab.style.color = 'white';
    creatorsTab.style.borderColor = 'transparent';
    
    postsTab.classList.remove('active');
    postsTab.style.background = 'var(--bg-secondary)';
    postsTab.style.color = 'var(--text-primary)';
    postsTab.style.borderColor = 'var(--border-color)';
  }
  
  // Re-run search if there's a query
  const searchInput = document.getElementById('searchInput');
  if (searchInput && searchInput.value.trim()) {
    handleSearch({ key: 'Enter' });
  }
}

// Handle search input
async function handleSearch(event) {
  // Search on Enter key or automatically after 2 characters
  const query = event.target.value.trim();
  
  if (query.length < 2) {
    // Show default message
    document.getElementById('searchResults').style.display = 'block';
    document.getElementById('searchResults').innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
        <i class="fas fa-search" style="font-size: 4rem; margin-bottom: 16px; opacity: 0.3;"></i>
        <h3 style="margin-bottom: 8px;">Search GigHub</h3>
        <p>Find posts, creators, and more</p>
      </div>
    `;
    document.getElementById('postsSearchResults').style.display = 'none';
    document.getElementById('creatorsSearchResults').style.display = 'none';
    return;
  }
  
  if (currentSearchType === 'posts') {
    await searchPosts(query);
  } else {
    await searchCreators(query);
  }
}

// Search posts
async function searchPosts(query) {
  try {
    const response = await fetch(`${API_URL}/api/search/posts?query=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (response.ok && data.posts && data.posts.length > 0) {
      document.getElementById('searchResults').style.display = 'none';
      document.getElementById('creatorsSearchResults').style.display = 'none';
      document.getElementById('postsSearchResults').style.display = 'grid';
      displayPostsSearchResults(data.posts);
    } else {
      document.getElementById('searchResults').style.display = 'block';
      document.getElementById('searchResults').innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
          <i class="fas fa-image" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.3;"></i>
          <h3 style="margin-bottom: 8px;">No Posts Found</h3>
          <p>Try a different search term</p>
        </div>
      `;
      document.getElementById('postsSearchResults').style.display = 'none';
      document.getElementById('creatorsSearchResults').style.display = 'none';
    }
  } catch (err) {
    console.error('Error searching posts:', err);
    showAlert('Error searching posts');
  }
}

// Display posts search results
function displayPostsSearchResults(posts) {
  const container = document.getElementById('postsSearchResults');
  
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

// Search creators
async function searchCreators(query) {
  try {
    const response = await fetch(`${API_URL}/api/search/creators?query=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (response.ok && data.creators && data.creators.length > 0) {
      document.getElementById('searchResults').style.display = 'none';
      document.getElementById('postsSearchResults').style.display = 'none';
      document.getElementById('creatorsSearchResults').style.display = 'block';
      displayCreatorsSearchResults(data.creators);
    } else {
      document.getElementById('searchResults').style.display = 'block';
      document.getElementById('searchResults').innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
          <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.3;"></i>
          <h3 style="margin-bottom: 8px;">No Creators Found</h3>
          <p>Try a different search term</p>
        </div>
      `;
      document.getElementById('postsSearchResults').style.display = 'none';
      document.getElementById('creatorsSearchResults').style.display = 'none';
    }
  } catch (err) {
    console.error('Error searching creators:', err);
    showAlert('Error searching creators');
  }
}

// Display creators search results
function displayCreatorsSearchResults(creators) {
  const container = document.getElementById('creatorsSearchResults');
  const currentUser = JSON.parse(localStorage.getItem('user'));
  
  container.innerHTML = creators.map(creator => {
    const isFollowing = creator.followers && creator.followers.includes(currentUser.id);
    
    return `
    <div class="post-card" style="margin-bottom: 16px; cursor: pointer;" onclick="viewCreatorProfile('${creator._id || creator.id}')">
      <div class="post-header">
        <div class="post-avatar" style="background: var(--ig-gradient);">${(creator.name || 'C').charAt(0).toUpperCase()}</div>
        <div class="post-user-info">
          <div class="post-username">${escapeHtml(creator.name || 'Creator')}</div>
          <div class="post-category"><i class="fas fa-palette"></i> ${escapeHtml(creator.skills && creator.skills.length > 0 ? creator.skills.slice(0, 3).join(', ') : 'Creator')}</div>
        </div>
      </div>

      ${creator.bio ? `
        <div class="post-caption">
          ${escapeHtml(creator.bio)}
        </div>
      ` : ''}

      ${creator.skills && creator.skills.length > 0 ? `
        <div style="padding: 0 16px 12px; display: flex; flex-wrap: wrap; gap: 8px;">
          ${creator.skills.slice(0, 5).map(skill => `
            <span style="background: var(--ig-gradient); color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">
              ${escapeHtml(skill)}
            </span>
          `).join('')}
        </div>
      ` : ''}

      <div style="padding: 12px 16px; display: flex; gap: 12px; border-top: 1px solid var(--border-color);">
        <button class="follow-btn ${isFollowing ? 'following' : ''}" onclick="event.stopPropagation(); followUser('${creator._id || creator.id}', this)">
          ${isFollowing ? '<i class="fas fa-check"></i> Following' : '<i class="fas fa-user-plus"></i> Follow'}
        </button>
        ${creator.whatsapp ? `
          <a href="https://wa.me/${creator.whatsapp.replace(/[^0-9]/g, '')}" target="_blank" onclick="event.stopPropagation();" class="contact-btn" style="flex: 1; text-align: center; text-decoration: none;">
            <i class="fab fa-whatsapp"></i> Contact
          </a>
        ` : ''}
      </div>

      <div class="post-time">
        <i class="fas fa-star"></i> ${creator.rating || 0} rating · ${creator.completedProjects || 0} projects
      </div>
    </div>
  `;
  }).join('');
}

// ==========================================
// CREATE POST
// ==========================================

// Current post type (default: 'post')
let currentPostType = 'post';

// Select post type
function selectPostType(type) {
  currentPostType = type;
  
  // Update button states
  document.querySelectorAll('.post-type-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`postType${type.charAt(0).toUpperCase() + type.slice(1)}`).classList.add('active');
  
  // Show/hide traditional post fields
  const traditionalFields = document.getElementById('traditionalPostFields');
  const captionField = document.getElementById('captionField');
  const mediaLabel = document.getElementById('mediaLabel');
  const mediaHint = document.getElementById('mediaHint');
  const postMedia = document.getElementById('postMedia');
  const createPostBtn = document.getElementById('createPostBtn');
  
  if (type === 'post') {
    traditionalFields.style.display = 'block';
    captionField.style.display = 'none';
    mediaLabel.textContent = 'Upload Images (optional, max 5)';
    mediaHint.innerHTML = '<i class="fas fa-image"></i> Images for your post';
    postMedia.accept = 'image/*';
    createPostBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Share Post';
  } else if (type === 'reel') {
    traditionalFields.style.display = 'none';
    captionField.style.display = 'block';
    mediaLabel.textContent = 'Upload Video (required)';
    mediaHint.innerHTML = '<i class="fas fa-film"></i> Vertical video (9:16 aspect ratio recommended)';
    postMedia.accept = 'video/*';
    createPostBtn.innerHTML = '<i class="fas fa-film"></i> Share Reel';
  } else if (type === 'short') {
    traditionalFields.style.display = 'none';
    captionField.style.display = 'block';
    mediaLabel.textContent = 'Upload Video (required)';
    mediaHint.innerHTML = '<i class="fas fa-video"></i> Short video (up to 60 seconds)';
    postMedia.accept = 'video/*';
    createPostBtn.innerHTML = '<i class="fas fa-video"></i> Share Short';
  } else if (type === 'video') {
    traditionalFields.style.display = 'none';
    captionField.style.display = 'block';
    mediaLabel.textContent = 'Upload Video (required)';
    mediaHint.innerHTML = '<i class="fas fa-play-circle"></i> Video content (any length)';
    postMedia.accept = 'video/*';
    createPostBtn.innerHTML = '<i class="fas fa-play-circle"></i> Share Video';
  }
}

document.getElementById('createPostForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('postType', currentPostType);
  
  const media = document.getElementById('postMedia').files;

  try {
    if (currentPostType === 'post') {
      // Traditional post requires all fields
      const title = document.getElementById('postTitle').value.trim();
      const category = document.getElementById('postCategory').value;
      const description = document.getElementById('postDescription').value.trim();
      const budget = document.getElementById('postBudget').value.trim();
      const whatsapp = document.getElementById('postWhatsapp').value.trim();

      if (!title || !category || !description || !budget) {
        showAlert('Please fill in all required fields');
        return;
      }

      formData.append('title', title);
      formData.append('category', category);
      formData.append('description', description);
      formData.append('budget', budget);
      if (whatsapp) formData.append('whatsapp', whatsapp);
    } else {
      // Reel/Short/Video only needs caption
      const caption = document.getElementById('postCaption').value.trim();
      formData.append('caption', caption);
      
      if (media.length === 0) {
        showAlert('Please upload a video file');
        return;
      }
    }

    // Add media files
    for (let i = 0; i < media.length; i++) {
      formData.append('media', media[i]);
    }

    console.log('Submitting post...', currentPostType);
    console.log('Media files:', media.length);

    const response = await fetch(`${API_URL}/api/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // NOTE: Don't set Content-Type - browser sets it automatically for FormData
      },
      body: formData
    });

    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', data);

    if (response.ok) {
      const typeLabel = currentPostType.charAt(0).toUpperCase() + currentPostType.slice(1);
      showAlert(`${typeLabel} created successfully! 🎉`, 'success');
      document.getElementById('createPostForm').reset();
      selectPostType('post'); // Reset to post type
      setTimeout(() => {
        showSection('feed');
      }, 1000);
    } else {
      console.error('Post creation failed:', data);
      showAlert(data.error || 'Failed to create post');
    }
  } catch (err) {
    console.error('Network error details:', err);
    showAlert('Network error: ' + err.message + '. Please check console for details.');
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

// Toggle Comments Section
function toggleComments(postId) {
  let commentsSection = document.getElementById(`comments-${postId}`);
  
  if (commentsSection) {
    // Toggle visibility
    if (commentsSection.style.display === 'none') {
      commentsSection.style.display = 'block';
    } else {
      commentsSection.style.display = 'none';
    }
  } else {
    // Create comments section if it doesn't exist
    createCommentsSection(postId);
  }
}

// Create Comments Section
function createCommentsSection(postId) {
  // Find the post card
  const postCards = document.querySelectorAll('.post-card');
  let targetPostCard = null;
  
  for (const card of postCards) {
    if (card.innerHTML.includes(`likePost('${postId}'`) || card.innerHTML.includes(`likePost("${postId}"`)) {
      targetPostCard = card;
      break;
    }
  }
  
  if (!targetPostCard) {
    console.error('Post card not found');
    return;
  }
  
  // Create comments section
  const commentsHTML = `
    <div id="comments-${postId}" class="comments-section" style="display: block;">
      <h4 style="margin-bottom: 12px; color: var(--ig-primary);">💬 Comments</h4>
      <div id="comments-list-${postId}">
        <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
          <i class="fas fa-spinner fa-spin"></i> Loading comments...
        </div>
      </div>
      <div style="margin-top: 12px; display: flex; gap: 8px;">
        <input type="text" id="comment-input-${postId}" placeholder="Add a comment..." 
          style="flex: 1; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px;">
        <button class="btn-primary" onclick="addComment('${postId}')" style="padding: 8px 16px; width: auto;">Post</button>
      </div>
    </div>
  `;
  
  // Insert before the contact section or at the end
  const contactSection = targetPostCard.querySelector('.post-contact');
  if (contactSection) {
    contactSection.insertAdjacentHTML('beforebegin', commentsHTML);
  } else {
    targetPostCard.insertAdjacentHTML('beforeend', commentsHTML);
  }
  
  // Load comments
  loadComments(postId);
}

// Load Comments
async function loadComments(postId) {
  try {
    const response = await fetch(`${API_URL}/api/posts/${postId}`);
    const data = await response.json();

    if (response.ok && data.post) {
      const commentsList = document.getElementById(`comments-list-${postId}`);
      if (commentsList) {
        if (data.post.comments && data.post.comments.length > 0) {
          commentsList.innerHTML = data.post.comments.map(comment => `
            <div class="comment-item">
              <strong>${escapeHtml(comment.userName)}</strong>
              <small style="float: right;">${formatDate(comment.timestamp)}</small>
              <p>${escapeHtml(comment.text)}</p>
            </div>
          `).join('');
        } else {
          commentsList.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">No comments yet. Be the first to comment!</p>';
        }
      }
    }
  } catch (err) {
    console.error('Error loading comments:', err);
    const commentsList = document.getElementById(`comments-list-${postId}`);
    if (commentsList) {
      commentsList.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Error loading comments</p>';
    }
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
    const response = await fetch(`${API_URL}/api/posts/${postId}/comment`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (response.ok) {
      input.value = '';
      showAlert('Comment added! 💬', 'success');
      
      // Reload comments to show the new one
      loadComments(postId);
      
      // Refresh feed to update comment count
      setTimeout(() => {
        loadFeed();
      }, 1000);
    } else {
      showAlert(data.error || 'Failed to add comment');
    }
  } catch (err) {
    console.error('Error adding comment:', err);
    showAlert('Network error. Please try again.');
  }
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
    const response = await fetch(`${API_URL}/api/follow/${userId}/follow`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      if (data.following) {
        button.innerHTML = '<i class="fas fa-check"></i> Following';
        button.classList.add('following');
        showAlert('User followed! ✓', 'success');
        
        // Update notification badge (new follow notification created)
        setTimeout(() => updateNotificationBadge(), 1000);
      } else {
        button.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
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

// Search Posts (for advanced search with filters)
async function searchPostsWithFilters(query, filters = {}) {
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


