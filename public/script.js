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

    // Show owner nav button — check isOwner flag OR phone number directly
    const OWNER_PHONE = '8410104406';
    if (user.isOwner || user.role === 'owner' || user.phone === OWNER_PHONE) {
      const adminBtn = document.getElementById('adminNavBtn');
      if (adminBtn) adminBtn.style.display = 'flex';
      // Patch currentUser so admin functions work
      currentUser.isOwner = true;
    }

    // Update profile section safely
    const profileUsername = document.getElementById('profileUsername');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileName = document.getElementById('profileName');
    
    if (profileUsername) profileUsername.textContent = user.name.toLowerCase().replace(/\s/g, '');
    if (profileAvatar) profileAvatar.textContent = user.name.charAt(0).toUpperCase();
    if (profileName) profileName.textContent = user.name;

    // Load feed immediately
    console.log('Initializing app...');
    try {
      loadFeed();
      loadStories();
      loadDashboard(); // non-blocking background load
      updateNotificationBadge();
      setInterval(updateNotificationBadge, 15000); // Poll every 15s for faster notification updates
    } catch (err) {
      console.error('Error during initialization:', err);
    }
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
      'profile': 4,
      'admin': 5
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
      case 'admin':
        loadAdminPanel();
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
  showSection('feed');
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
    const [postsRes, reelsRes] = await Promise.all([
      fetch(`${API_URL}/api/posts`),
      fetch(`${API_URL}/api/status-shorts/feed?tab=latest&limit=30&type=shorts`)
    ]);

    const postsData = postsRes.ok ? await postsRes.json() : { posts: [] };
    const reelsData = reelsRes.ok ? await reelsRes.json() : { posts: [] };

    console.log('[Feed] posts:', (postsData.posts||[]).length, '| shorts raw:', (reelsData.posts||[]).length);

    // Shorts = only type:'shorts' from StatusShorts collection
    const shorts = (reelsData.posts || []).filter(p => p.type === 'shorts');
    console.log('[Feed] shorts after filter:', shorts.length);

    // Regular posts feed = all Post documents, sorted newest first
    const feedItems = (postsData.posts || [])
      .map(p => ({ ...p, _feedType: 'post' }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Store for filter
    _allFeedPosts = feedItems;

    // Render shorts row at top
    renderShortsRow(shorts);

    // Render vertical posts feed (apply current filter)
    const filtered = _feedFilter === 'all' ? feedItems : feedItems.filter(p => p.category === _feedFilter);
    displayFeed(filtered);
  } catch (err) {
    console.error('Error loading feed:', err);
  }
}

// All shorts for viewer
let _allShorts = [];
let _svIndex = 0;

// Feed filter state
let _feedFilter = 'all';
let _allFeedPosts = [];

function setFeedFilter(category, btn) {
  _feedFilter = category;
  document.querySelectorAll('.feed-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const filtered = category === 'all' ? _allFeedPosts : _allFeedPosts.filter(p => p.category === category);
  displayFeed(filtered);
}

// Scroll to top button visibility
window.addEventListener('scroll', () => {
  const btn = document.getElementById('scrollTopBtn');
  if (btn) btn.style.display = window.scrollY > 400 ? 'flex' : 'none';
}, { passive: true });

function renderShortsRow(shorts) {
  _allShorts = shorts;
  const row = document.getElementById('shortsRow');
  const wrap = document.getElementById('shortsRowWrap');
  console.log('[Shorts] row el:', !!row, '| wrap el:', !!wrap, '| count:', shorts?.length);
  if (!row || !wrap) return;

  if (!shorts || shorts.length === 0) {
    wrap.classList.remove('visible');
    row.innerHTML = '';
    return;
  }

  // Force show via class
  wrap.classList.add('visible');

  row.innerHTML = shorts.map((s, i) => {
    const src = `${API_URL}${s.mediaUrl || ''}`;
    const isVideo = s.mediaType === 'video';
    return `
    <div class="short-thumb" onclick="openShortsViewer(${i})">
      ${isVideo
        ? `<video src="${src}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover;pointer-events:none;"></video>`
        : `<img src="${src}" alt="short" loading="lazy">`}
      <div class="short-thumb-overlay">
        <div class="short-thumb-user">@${escapeHtml(s.userName || 'user')}</div>
        ${s.caption ? `<div class="short-thumb-caption">${escapeHtml(s.caption)}</div>` : ''}
      </div>
      <div class="short-play-icon"><i class="fas fa-play"></i></div>
    </div>`;
  }).join('');
  console.log('[Shorts] row rendered, count:', shorts.length);
}
function openShortsViewer(index) {
  _svIndex = index;
  const modal = document.getElementById('shortsViewerModal');
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  _loadShortsViewerItem();
  _initShortsSwipe();
}

function closeShortsViewer() {
  const modal = document.getElementById('shortsViewerModal');
  if (modal) modal.classList.remove('open');
  const v = document.getElementById('shortsViewerVideo');
  if (v) { v.pause(); v.src = ''; }
  document.body.style.overflow = '';
}

function _loadShortsViewerItem() {
  const s = _allShorts[_svIndex];
  if (!s) return;
  const v = document.getElementById('shortsViewerVideo');
  const user = document.getElementById('svUser');
  const cap = document.getElementById('svCap');
  const lc = document.getElementById('svLikeCount');
  const cc = document.getElementById('svCommentCount');
  if (v) {
    v.pause();
    v.src = `${API_URL}${s.mediaUrl || ''}`;
    v.load();
    v.play().catch(() => {});
  }
  if (user) user.textContent = '@' + (s.userName || 'user');
  if (cap) cap.textContent = s.caption || '';
  if (lc) lc.textContent = (s.likes || []).length;
  if (cc) cc.textContent = (s.comments || []).length;
  // Update progress dots
  _updateSvDots();
  // Track view
  const token = localStorage.getItem('token');
  if (token && s._id) {
    fetch(`${API_URL}/api/status-shorts/${s._id}/view`, {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + token }
    }).catch(() => {});
  }
}

function _updateSvDots() {
  const dots = document.getElementById('svDots');
  if (!dots || _allShorts.length <= 1) { if (dots) dots.innerHTML = ''; return; }
  const max = Math.min(_allShorts.length, 8);
  dots.innerHTML = Array.from({ length: max }, (_, i) =>
    `<div style="width:6px;height:6px;border-radius:50%;background:${i === _svIndex % max ? '#fff' : 'rgba(255,255,255,.4)'};transition:background .2s;"></div>`
  ).join('');
}

// Touch swipe support for shorts viewer
let _svTouchStartY = 0;
function _initShortsSwipe() {
  const inner = document.getElementById('shortsViewerInner');
  if (!inner || inner._swipeInit) return;
  inner._swipeInit = true;
  inner.addEventListener('touchstart', (e) => { _svTouchStartY = e.touches[0].clientY; }, { passive: true });
  inner.addEventListener('touchend', (e) => {
    const dy = _svTouchStartY - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 50) svNav(dy > 0 ? 1 : -1);
  }, { passive: true });
  // Keyboard support
  document.addEventListener('keydown', _svKeyHandler);
}
function _svKeyHandler(e) {
  const modal = document.getElementById('shortsViewerModal');
  if (!modal || !modal.classList.contains('open')) return;
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') svNav(-1);
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') svNav(1);
  if (e.key === 'Escape') closeShortsViewer();
}

function svNav(dir) {
  _svIndex = Math.max(0, Math.min(_allShorts.length - 1, _svIndex + dir));
  _loadShortsViewerItem();
}

function svLike() {
  const s = _allShorts[_svIndex];
  if (!s) return;
  likeReel(s._id || s.id, document.getElementById('svLikeBtn'));
}

function svComment() {
  const s = _allShorts[_svIndex];
  if (!s) return;
  closeShortsViewer();
  setTimeout(() => toggleReelComments(s._id || s.id), 300);
}

function svShare() {
  const s = _allShorts[_svIndex];
  if (!s) return;
  sharePost(s._id || s.id, s.caption || 'Check this out on GigHub');
}

function displayFeed(posts, containerId) {
  const container = document.getElementById(containerId || 'feedContainer');
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

    // All items in feed are Post documents now
    // postType is either 'post' (traditional) or 'video'
    const postType = post.postType || 'post';
    const isVideoPost = postType === 'video';
    const videoUrl = post.videoUrl || '';
    const mediaType = post.mediaType || 'image';
    const caption = post.caption || post.description || '';

    // Media display
    let mediaHTML = '';
    if (isVideoPost && videoUrl) {
      mediaHTML = `
        <div class="video-container">
          <video src="${API_URL}${videoUrl}" controls playsinline preload="metadata"
            style="width:100%;max-height:560px;object-fit:contain;background:#000;display:block;"></video>
        </div>`;
    } else if (post.images && post.images.length > 0) {
      mediaHTML = `
        <div style="position:relative;" ondblclick="likePost('${post._id||post.id}',this.querySelector('.like-dbl-btn'));showDoubleTapHeart(this)">
          <img src="${API_URL}${post.images[0]}" class="post-image" alt="${escapeHtml(post.title || 'Post')}" loading="lazy">
          <button class="like-dbl-btn action-btn ${isLiked?'liked':''}" style="display:none;" data-post-id="${post._id||post.id}"></button>
          <div class="dbl-heart" style="display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:4rem;pointer-events:none;animation:heartPop .6s ease forwards;">❤️</div>
        </div>`;
    } else if (isVideoPost) {
      mediaHTML = `<div style="width:100%;height:200px;background:#000;display:flex;align-items:center;justify-content:center;color:#fff;font-size:2rem;"><i class="fas fa-video"></i></div>`;
    } else {
      mediaHTML = `<div style="width:100%;height:180px;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:white;font-size:3rem;"><i class="fas fa-briefcase"></i></div>`;
    }

    // Caption / description
    let captionHTML = '';
    if (postType === 'post') {
      if (post.description) captionHTML += `<div class="post-caption"><strong>${escapeHtml(post.userName || 'Anonymous')}</strong> ${escapeHtml(post.description)}</div>`;
      if (post.budget) captionHTML += `<div class="post-budget">💰 ${escapeHtml(post.budget)}</div>`;
    } else if (caption) {
      captionHTML = `<div class="post-caption"><strong>${escapeHtml(post.userName || 'Anonymous')}</strong> ${escapeHtml(caption)}</div>`;
    }

    // Video badge
    const badgeHTML = isVideoPost
      ? `<span style="background:var(--ig-gradient);color:#fff;padding:2px 8px;border-radius:10px;font-size:.72rem;font-weight:700;margin-left:6px;">📹 Video</span>`
      : '';

    const postOwnerId = post.userId?._id || post.userId;
    const isOwner = postOwnerId && postOwnerId.toString() === user.id.toString();
    const followBtn = !isOwner && postOwnerId
      ? `<button class="follow-btn" onclick="followUser('${postOwnerId}',this)" style="margin-left:auto;padding:5px 12px;font-size:.8rem;"><i class="fas fa-user-plus"></i> Follow</button>`
      : '';
    const deleteBtn = isOwner
      ? `<button onclick="deletePost('${post._id || post.id}',this)" style="margin-left:auto;background:none;border:none;color:#ef4444;cursor:pointer;padding:4px 8px;" title="Delete"><i class="fas fa-trash-alt"></i></button>`
      : '';

    const contactHTML = (postType === 'post' && (post.userWhatsapp || post.userPhone))
      ? `<div class="post-contact"><a href="https://wa.me/${(post.userWhatsapp||post.userPhone||'').replace(/[^0-9]/g,'')}" target="_blank" class="contact-btn"><i class="fab fa-whatsapp"></i> Contact on WhatsApp</a></div>`
      : '';

    const postId = post._id || post.id;

    return `
    <div class="post-card">
      <div class="post-header">
        <div class="post-avatar">${(post.userName||'A').charAt(0).toUpperCase()}</div>
        <div class="post-user-info" style="flex:1;">
          <div class="post-username">${escapeHtml(post.userName||'Anonymous')}${badgeHTML}</div>
          <div class="post-category">${isVideoPost ? '📹 Video' : formatCategory(post.category)}</div>
        </div>
        ${followBtn}${deleteBtn}
      </div>
      ${mediaHTML}
      <div class="post-actions">
        <div class="post-actions-left">
          <button class="action-btn ${isLiked?'liked':''}" onclick="likePost('${postId}',this)">
            <i class="${isLiked?'fas':'far'} fa-heart"></i>
          </button>
          <button class="action-btn" onclick="toggleComments('${postId}')">
            <i class="far fa-comment"></i>
          </button>
          <button class="action-btn" onclick="sharePost('${postId}','${(post.title||caption||'').replace(/'/g,"\\'")}')">
            <i class="far fa-paper-plane"></i>
          </button>
        </div>
        <button class="action-btn" onclick="toggleBookmark('${postId}',this)">
          <i class="far fa-bookmark"></i>
        </button>
      </div>
      <div class="post-likes">${post.likes?.length||0} likes</div>
      ${captionHTML}
      ${post.comments?.length > 0 ? `<div class="post-comments" onclick="toggleComments('${postId}')">View all ${post.comments.length} comments</div>` : ''}
      <div class="post-time">${formatDate(post.createdAt)}</div>
      ${contactHTML}
      <div id="post-comments-${postId}" class="comments-section" style="display:none;">
        <h4 style="margin-bottom:12px;color:var(--ig-primary);">💬 Comments</h4>
        <div id="post-comments-list-${postId}">
          ${(post.comments||[]).map(c=>`<div class="comment-item"><strong>${escapeHtml(c.userName)}</strong><small style="float:right;">${formatDate(c.timestamp)}</small><p>${escapeHtml(c.text)}</p></div>`).join('')}
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <input type="text" id="post-comment-input-${postId}" placeholder="Add a comment..." style="flex:1;padding:8px 12px;border:1px solid var(--border-color);border-radius:6px;">
          <button class="btn-primary" onclick="addComment('${postId}')" style="padding:8px 16px;width:auto;">Post</button>
        </div>
      </div>
    </div>`;
  }).join('');

  // Auto-track views for visible videos
  container.querySelectorAll('video').forEach((video, idx) => {
    video.addEventListener('play', () => {
      const postId = posts[idx]?._id || posts[idx]?.id;
      if (postId) trackReelView(postId);
    });
  });
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
  if (searchInput && searchInput.value.trim().length >= 2) {
    if (type === 'posts') searchPosts(searchInput.value.trim());
    else searchCreators(searchInput.value.trim());
  }
}

// Handle search input
// Handle search input — debounced, reads from input directly
let _searchDebounceTimer = null;
function handleSearch(event) {
  clearTimeout(_searchDebounceTimer);
  _searchDebounceTimer = setTimeout(async () => {
    const input = document.getElementById('searchInput');
    const query = input ? input.value.trim() : '';

    if (query.length < 2) {
      const sr = document.getElementById('searchResults');
      if (sr) {
        sr.style.display = 'block';
        sr.innerHTML = `
          <div style="text-align:center;padding:60px 20px;color:var(--text-secondary);">
            <i class="fas fa-search" style="font-size:4rem;margin-bottom:16px;opacity:.3;"></i>
            <h3 style="margin-bottom:8px;">Search GigHub</h3>
            <p>Find posts, creators, and more</p>
          </div>`;
      }
      const pr = document.getElementById('postsSearchResults');
      const cr = document.getElementById('creatorsSearchResults');
      if (pr) pr.style.display = 'none';
      if (cr) cr.style.display = 'none';
      return;
    }

    if (currentSearchType === 'posts') {
      await searchPosts(query);
    } else {
      await searchCreators(query);
    }
  }, 350);
}

// Search posts
async function searchPosts(query) {
  const sr = document.getElementById('searchResults');
  const pr = document.getElementById('postsSearchResults');
  const cr = document.getElementById('creatorsSearchResults');
  if (sr) { sr.style.display = 'block'; sr.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i><p style="margin-top:12px;">Searching...</p></div>'; }
  if (pr) pr.style.display = 'none';
  if (cr) cr.style.display = 'none';
  try {
    const response = await fetch(`${API_URL}/api/search/posts?query=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (response.ok && data.posts && data.posts.length > 0) {
      if (sr) sr.style.display = 'none';
      if (cr) cr.style.display = 'none';
      if (pr) pr.style.display = 'grid';
      displayPostsSearchResults(data.posts);
    } else {
      if (sr) { sr.style.display = 'block'; sr.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-secondary);"><i class="fas fa-image" style="font-size:3rem;margin-bottom:16px;opacity:.3;"></i><h3 style="margin-bottom:8px;">No Posts Found</h3><p>Try a different search term</p></div>`; }
      if (pr) pr.style.display = 'none';
      if (cr) cr.style.display = 'none';
    }
  } catch (err) {
    console.error('Error searching posts:', err);
    if (sr) { sr.style.display = 'block'; sr.innerHTML = '<div style="text-align:center;padding:40px;color:#e53e3e;">Search failed. Please try again.</div>'; }
  }
}

// Display posts search results
function displayPostsSearchResults(posts) {
  const container = document.getElementById('postsSearchResults');
  container.innerHTML = posts.map(post => {
    const postId = post._id || post.id;
    return `
    <div class="explore-item" onclick="openSearchPost('${postId}')" style="cursor:pointer;">
      ${post.images && post.images.length > 0
        ? `<img src="${API_URL}${post.images[0]}" alt="${escapeHtml(post.title||'')}" loading="lazy">`
        : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:white;font-size:2rem;"><i class="fas fa-briefcase"></i></div>`}
      <div class="explore-overlay">
        <span><i class="fas fa-heart"></i> ${post.likes?.length||0}</span>
        <span><i class="fas fa-comment"></i> ${post.comments?.length||0}</span>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:rgba(0,0,0,.6);color:#fff;font-size:.72rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(post.title||post.caption||'')}</div>
    </div>`;
  }).join('');
}

function openSearchPost(postId) {
  // Go to feed and scroll to the post
  showSection('feed');
  setTimeout(() => {
    const el = document.querySelector(`[data-post-id="${postId}"]`) ||
               document.getElementById(`post-${postId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 500);
}

// Search creators
async function searchCreators(query) {
  const sr = document.getElementById('searchResults');
  const pr = document.getElementById('postsSearchResults');
  const cr = document.getElementById('creatorsSearchResults');
  if (sr) { sr.style.display = 'block'; sr.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);"><i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i><p style="margin-top:12px;">Searching...</p></div>'; }
  if (pr) pr.style.display = 'none';
  if (cr) cr.style.display = 'none';
  try {
    const response = await fetch(`${API_URL}/api/search/creators?query=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (response.ok && data.creators && data.creators.length > 0) {
      if (sr) sr.style.display = 'none';
      if (pr) pr.style.display = 'none';
      if (cr) cr.style.display = 'block';
      displayCreatorsSearchResults(data.creators);
    } else {
      if (sr) { sr.style.display = 'block'; sr.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-secondary);"><i class="fas fa-users" style="font-size:3rem;margin-bottom:16px;opacity:.3;"></i><h3 style="margin-bottom:8px;">No Creators Found</h3><p>Try a different search term</p></div>`; }
      if (pr) pr.style.display = 'none';
      if (cr) cr.style.display = 'none';
    }
  } catch (err) {
    console.error('Error searching creators:', err);
    if (sr) { sr.style.display = 'block'; sr.innerHTML = '<div style="text-align:center;padding:40px;color:#e53e3e;">Search failed. Please try again.</div>'; }
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
  } else if (type === 'short') {
    traditionalFields.style.display = 'none';
    captionField.style.display = 'block';
    mediaLabel.textContent = 'Upload Short Video (required)';
    mediaHint.innerHTML = '<i class="fas fa-video"></i> Short — 9:16 portrait, max 60 seconds · Will appear in Shorts row ⚡';
    postMedia.accept = 'video/*';
    createPostBtn.innerHTML = '<i class="fas fa-bolt"></i> Upload Short ⚡';
  } else if (type === 'video') {
    traditionalFields.style.display = 'none';
    captionField.style.display = 'block';
    mediaLabel.textContent = 'Upload Video (required)';
    mediaHint.innerHTML = '<i class="fas fa-play-circle"></i> Video content (any size, any length)';
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
  const submitBtn = document.getElementById('createPostBtn');
  const originalBtnText = submitBtn.innerHTML;

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
      // Short/Video only needs caption
      const caption = document.getElementById('postCaption').value.trim();
      formData.append('caption', caption);
      
      if (media.length === 0) {
        showAlert('Please upload a video file');
        return;
      }

      // Shorts go to /api/status-shorts/upload, NOT /api/posts
      if (currentPostType === 'short') {
        if (media[0].type.startsWith('video/')) {
          try {
            await validateShortsVideo(media[0]);
          } catch (validationError) {
            showAlert(validationError);
            return;
          }
        }
        // Upload as short
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading Short...';
        try {
          const shortForm = new FormData();
          shortForm.append('media', media[0]);
          shortForm.append('type', 'shorts');
          if (caption) shortForm.append('caption', caption);
          const r = await fetch(`${API_URL}/api/status-shorts/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: shortForm
          });
          const d = await r.json();
          if (r.ok) {
            showAlert('Short uploaded successfully! ⚡', 'success');
            document.getElementById('createPostForm').reset();
            selectPostType('post');
            setTimeout(() => showSection('feed'), 800);
          } else {
            showAlert(d.error || 'Upload failed');
          }
        } catch (err) {
          showAlert('Network error: ' + err.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
        return; // stop here — don't fall through to /api/posts
      }
    }

    // Add media files
    for (let i = 0; i < media.length; i++) {
      formData.append('media', media[i]);
    }

    console.log('Submitting post...', currentPostType);
    console.log('Media files:', media.length);

    // Show upload progress
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading... 0%';
    
    // Create progress bar if it doesn't exist
    let progressBar = document.getElementById('uploadProgressBar');
    if (!progressBar) {
      const progressContainer = document.createElement('div');
      progressContainer.id = 'uploadProgressContainer';
      progressContainer.style.cssText = 'margin-top: 15px; background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; height: 8px;';
      
      progressBar = document.createElement('div');
      progressBar.id = 'uploadProgressBar';
      progressBar.style.cssText = 'height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); width: 0%; transition: width 0.3s ease; border-radius: 10px;';
      
      progressContainer.appendChild(progressBar);
      document.getElementById('createPostForm').appendChild(progressContainer);
    }

    const response = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading... ${percentComplete}%`;
          progressBar.style.width = percentComplete + '%';
        }
      });
      
      // Upload complete
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ ok: true, status: xhr.status, data: JSON.parse(xhr.responseText) });
        } else {
          resolve({ ok: false, status: xhr.status, data: JSON.parse(xhr.responseText || '{"error":"Upload failed"}') });
        }
      });
      
      // Upload error
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });
      
      xhr.open('POST', `${API_URL}/api/posts`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });

    console.log('Response status:', response.status);
    console.log('Response data:', response.data);

    if (response.ok) {
      const typeLabel = currentPostType.charAt(0).toUpperCase() + currentPostType.slice(1);
      showAlert(`${typeLabel} created successfully! 🎉`, 'success');
      document.getElementById('createPostForm').reset();
      
      // Hide progress bar
      const progressContainer = document.getElementById('uploadProgressContainer');
      if (progressContainer) {
        progressContainer.remove();
      }
      
      selectPostType('post'); // Reset to post type
      setTimeout(() => {
        showSection('feed');
      }, 1000);
    } else {
      console.error('Post creation failed:', response.data);
      showAlert(response.data.error || 'Failed to create post');
    }
  } catch (err) {
    console.error('Network error details:', err);
    showAlert('Network error: ' + err.message + '. Please check console for details.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
});

// ==========================================
// PROFILE
// ==========================================

async function loadProfile() {
  try {
    // Fetch full user details from server
    const [profileRes, postsRes] = await Promise.all([
      fetch(`${API_URL}/api/users/my-profile`, { headers: getAuthHeaders() }),
      fetch(`${API_URL}/api/posts/my`, { headers: getAuthHeaders() })
    ]);

    if (profileRes.ok) {
      const { user } = await profileRes.json();
      // Update avatar and username in header
      const av = document.getElementById('profileAvatar');
      const un = document.getElementById('profileUsername');
      if (av) av.textContent = (user.name || 'U').charAt(0).toUpperCase();
      if (un) un.textContent = (user.name || '').toLowerCase().replace(/\s/g, '');

      // Update followers/following stats
      document.getElementById('profileFollowers').textContent = user.followers?.length || 0;
      document.getElementById('profileFollowing').textContent = user.following?.length || 0;

      // Fill details card
      document.getElementById('pdName').textContent = user.name || '—';
      document.getElementById('pdPhone').textContent = user.phone || '—';
      document.getElementById('pdEmail').textContent = user.email || '—';
      document.getElementById('pdRole').textContent = (user.role || 'user').charAt(0).toUpperCase() + (user.role || 'user').slice(1);
      document.getElementById('pdJoined').textContent = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' }) : '—';

      // Store for edit modal pre-fill
      window._profileUser = user;
    }

    if (postsRes.ok) {
      const data = await postsRes.json();
      document.getElementById('profilePosts').textContent = data.posts?.length || 0;
      displayFeed(data.posts || [], 'profilePostsContainer');
    }
  } catch (err) {
    console.error('Error loading profile:', err);
  }
}

function openEditAccountModal() {
  const u = window._profileUser || JSON.parse(localStorage.getItem('user') || '{}');
  document.getElementById('editName').value = u.name || '';
  document.getElementById('editEmail').value = u.email || '';
  document.getElementById('editPhone').value = '';
  document.getElementById('editCurrentPassword').value = '';
  document.getElementById('editNewPassword').value = '';
  document.getElementById('editAccountModal').style.display = 'flex';
}

function closeEditAccountModal() {
  document.getElementById('editAccountModal').style.display = 'none';
}

async function saveAccountChanges() {
  const name = document.getElementById('editName').value.trim();
  const email = document.getElementById('editEmail').value.trim();
  const phone = document.getElementById('editPhone').value.trim();
  const currentPassword = document.getElementById('editCurrentPassword').value;
  const newPassword = document.getElementById('editNewPassword').value;

  if (!name) { showAlert('Name cannot be empty'); return; }

  const body = { name, email };
  if (phone || newPassword) {
    if (!currentPassword) { showAlert('Enter your current password to change phone or password'); return; }
    body.currentPassword = currentPassword;
    if (phone) body.phone = phone;
    if (newPassword) body.newPassword = newPassword;
  }

  try {
    const res = await fetch(`${API_URL}/api/users/account`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      showAlert('Account updated successfully!', 'success');
      closeEditAccountModal();
      // Update localStorage user
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const updated = { ...stored, name: data.user.name, email: data.user.email, phone: data.user.phone || stored.phone };
      localStorage.setItem('user', JSON.stringify(updated));
      currentUser = updated;
      loadProfile();
    } else {
      showAlert(data.error || 'Update failed');
    }
  } catch (err) {
    showAlert('Network error. Please try again.');
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
  // Try both ID formats (post-comments-X and comments-X)
  let commentsSection = document.getElementById(`post-comments-${postId}`) || document.getElementById(`comments-${postId}`);
  
  if (commentsSection) {
    commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
  } else {
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
  // Try both ID formats
  const input = document.getElementById(`post-comment-input-${postId}`) || document.getElementById(`comment-input-${postId}`);
  if (!input) return;
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
      loadComments(postId);
      // Update comment list inline without full feed reload
      const commentsList = document.getElementById(`post-comments-list-${postId}`);
      if (commentsList && data.comments) {
        commentsList.innerHTML = data.comments.map(c =>
          `<div class="comment-item"><strong>${escapeHtml(c.userName)}</strong><small style="float:right;">${formatDate(c.timestamp)}</small><p>${escapeHtml(c.text)}</p></div>`
        ).join('');
      }
    } else {
      showAlert(data.error || 'Failed to add comment');
    }
  } catch (err) {
    console.error('Error adding comment:', err);
    showAlert('Network error. Please try again.');
  }
}

// ==========================================
// DELETE POST / REEL
// ==========================================

async function deletePost(postId, btn) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  try {
    const response = await fetch(`${API_URL}/api/posts/${postId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (response.ok) {
      showAlert('Post deleted', 'success');
      btn.closest('.post-card').remove();
    } else {
      showAlert(data.error || 'Failed to delete post');
    }
  } catch (err) {
    showAlert('Network error. Please try again.');
  }
}

async function deleteReel(postId, btn) {
  if (!confirm('Delete this reel/short? This cannot be undone.')) return;
  try {
    const response = await fetch(`${API_URL}/api/status-shorts/${postId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (response.ok) {
      showAlert('Deleted successfully', 'success');
      btn.closest('.post-card').remove();
    } else {
      showAlert(data.error || 'Failed to delete');
    }
  } catch (err) {
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

// Double-tap heart animation
function showDoubleTapHeart(container) {
  const heart = container.querySelector('.dbl-heart');
  if (!heart) return;
  heart.style.display = 'block';
  heart.style.animation = 'none';
  void heart.offsetWidth; // reflow
  heart.style.animation = 'heartPop .7s ease forwards';
  setTimeout(() => { heart.style.display = 'none'; }, 700);
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

// Validate shorts video: must be 9:16 aspect ratio and under 60 seconds
function validateShortsVideo(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (duration > 60) {
        return reject(`Shorts must be 60 seconds or less. Your video is ${Math.round(duration)}s long.`);
      }
      // Enforce 9:16 portrait — width/height ratio must be ≤ 0.6 (with small tolerance)
      if (width > 0 && height > 0) {
        const ratio = width / height;
        if (ratio > 0.65) {
          return reject('Shorts must be in 9:16 portrait format (vertical video only). Please rotate or crop your video.');
        }
      }
      resolve();
    };
    video.onerror = () => { URL.revokeObjectURL(url); resolve(); }; // skip check if metadata fails
  });
}

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

  // Validate shorts video constraints
  if (type === 'shorts' && media.type.startsWith('video/')) {
    try {
      await validateShortsVideo(media);
    } catch (validationError) {
      showAlert(validationError);
      return;
    }
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
      showAlert('Upload successful!', 'success');
      document.getElementById('statusShortsForm').reset();
      setTimeout(() => {
        showSection('feed');
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
    
    // Delete button for reel owner
    const reelOwnerId = post.userId?._id || post.userId;
    const reelDeleteBtn = reelOwnerId && reelOwnerId.toString() === user.id.toString()
      ? `<button onclick="deleteReel('${post._id || post.id}', this)" style="margin-left: auto; background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px 8px; font-size: 0.85rem;" title="Delete"><i class="fas fa-trash-alt"></i></button>`
      : '';

    return `
    <div class="post-card" style="margin-bottom: 20px;">
      <div class="post-header">
        <div class="post-avatar">${(post.userName || 'A').charAt(0).toUpperCase()}</div>
        <div class="post-user-info" style="flex:1;">
          <div class="post-username">
            ${escapeHtml(post.userName || 'Anonymous')}
            <span class="type-badge ${post.type === 'status' ? 'badge-status' : 'badge-shorts'}">
              ${post.type === 'status' ? '⏰ Status' : '🎬 Shorts'}
            </span>
          </div>
          <div class="post-category">${post.mediaType === 'video' ? '📹 Video' : '🖼️ Image'}</div>
        </div>
        ${reelDeleteBtn}
      </div>

      ${post.mediaType === 'video' ? `
        <div class="video-container">
          <video src="${API_URL}${post.mediaUrl}" controls playsinline preload="metadata" style="width:100%;max-height:560px;object-fit:contain;background:#000;display:block;"></video>
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
      // Update comment list inline
      const commentsList = document.getElementById(`reel-comments-list-${postId}`);
      if (commentsList && data.comments) {
        commentsList.innerHTML = data.comments.map(c =>
          `<div class="comment-item"><strong>${escapeHtml(c.userName)}</strong><small style="float:right;">${formatDate(c.timestamp)}</small><p>${escapeHtml(c.text)}</p></div>`
        ).join('');
      }
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
  if (button.disabled) return;
  const prevHTML = button.innerHTML;
  button.disabled = true;
  button.style.opacity = '0.7';
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
        setTimeout(() => updateNotificationBadge(), 1000);
      } else {
        button.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
        button.classList.remove('following');
        showAlert('Unfollowed', 'success');
      }
      const followersElement = document.getElementById('profileFollowers');
      if (followersElement && data.followers !== undefined) {
        followersElement.textContent = data.followers;
      }
    } else {
      button.innerHTML = prevHTML;
      showAlert(data.error || 'Failed to follow user');
    }
  } catch (err) {
    button.innerHTML = prevHTML;
    showAlert('Network error. Please try again.');
  } finally {
    button.disabled = false;
    button.style.opacity = '';
  }
}

// Check if following a user
async function checkFollowStatus(userId, button) {
  try {
    const response = await fetch(`${API_URL}/api/follow/${userId}/follow-status`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (response.ok) {
      if (data.following) {
        button.innerHTML = '<i class="fas fa-check"></i> Following';
        button.classList.add('following');
      } else {
        button.innerHTML = '<i class="fas fa-user-plus"></i> Follow';
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
    const response = await fetch(`${API_URL}/api/follow/${userId}/followers`, {
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
    const response = await fetch(`${API_URL}/api/follow/${userId}/following`, {
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
  let modal = document.getElementById('notificationsModal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'notificationsModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:500px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;padding:0;border-radius:16px;">
        <div style="padding:16px 20px;background:var(--ig-gradient);color:#fff;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <span style="font-weight:800;font-size:1.1rem;">🔔 Notifications</span>
          <button onclick="closeNotifications()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1.1rem;">&times;</button>
        </div>
        <div style="padding:10px 16px;border-bottom:1px solid var(--border-color);display:flex;gap:8px;flex-shrink:0;">
          <button onclick="markAllNotificationsAsRead()" style="flex:1;padding:8px;background:var(--bg-primary);border:1.5px solid var(--border-color);border-radius:8px;cursor:pointer;font-weight:600;font-size:.85rem;color:var(--text-primary);">
            <i class="fas fa-check-double"></i> Mark All Read
          </button>
          <button onclick="clearAllNotifications()" style="flex:1;padding:8px;background:#fef2f2;border:1.5px solid #fecaca;border-radius:8px;cursor:pointer;font-weight:600;font-size:.85rem;color:#dc2626;">
            <i class="fas fa-trash-alt"></i> Clear All
          </button>
        </div>
        <div id="notificationsList" style="overflow-y:auto;flex:1;"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  modal.style.display = 'flex';
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
    list.innerHTML = data.notifications.map(n => {
      const iconMap = { like: '❤️', comment: '💬', follow: '👤', bookmark: '🔖' };
      const icon = iconMap[n.type] || '🔔';
      return `
      <div style="padding:14px 16px;border-bottom:1px solid var(--border-color);display:flex;gap:12px;align-items:start;${n.isRead ? '' : 'background:rgba(64,93,230,.04);'}cursor:pointer;" onclick="markNotificationAsRead('${n._id||n.id}');this.style.background='transparent';">
        <div style="font-size:1.4rem;flex-shrink:0;margin-top:2px;">${icon}</div>
        <div style="flex:1;">
          <p style="margin:0 0 3px;font-size:.9rem;line-height:1.4;">${n.message}</p>
          <small style="color:var(--text-secondary);">${formatDate(n.createdAt)}</small>
        </div>
        ${!n.isRead ? '<div style="width:8px;height:8px;background:var(--ig-primary);border-radius:50%;flex-shrink:0;margin-top:6px;"></div>' : ''}
      </div>`;
    }).join('');
  } else {
    list.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text-secondary);">
        <div style="font-size:3rem;margin-bottom:12px;">🔔</div>
        <p style="font-weight:600;">No notifications yet</p>
        <p style="font-size:.85rem;margin-top:6px;">When someone likes or comments on your posts, you'll see it here.</p>
      </div>`;
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
      loadAndDisplayNotifications();
    }
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
  }
}

// Clear All Notifications
async function clearAllNotifications() {
  if (!confirm('Clear all notifications? This cannot be undone.')) return;
  try {
    const response = await fetch(`${API_URL}/api/notifications/clear-all`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (response.ok) {
      showAlert('All notifications cleared', 'success');
      updateNotificationBadge();
      const list = document.getElementById('notificationsList');
      if (list) list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:40px 0;">No notifications</p>';
    } else {
      // Fallback: mark all read if delete endpoint not available
      await markAllNotificationsAsRead();
    }
  } catch (err) {
    console.error('Error clearing notifications:', err);
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

// ==========================================
// OWNER / ADMIN PANEL
// ==========================================

let adminCurrentTab = 'users';
let adminCurrentPage = 1;
let adminSearchQuery = '';

async function loadAdminPanel() {
  await loadAdminStats();
  await loadAdminTab(adminCurrentTab, 1, '');
}

async function loadAdminStats() {
  try {
    const res = await fetch(`${API_URL}/api/admin/stats`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const { stats } = await res.json();
    const bar = document.getElementById('adminStatsBar');
    if (!bar) return;
    bar.innerHTML = [
      { label: 'Users', val: stats.totalUsers, icon: '👥' },
      { label: 'Posts', val: stats.totalPosts, icon: '📝' },
      { label: 'Shorts', val: stats.totalShorts, icon: '🎬' },
      { label: 'Creators', val: stats.totalCreators, icon: '🎨' }
    ].map(s => `
      <div style="text-align:center;background:rgba(255,255,255,.1);border-radius:10px;padding:8px 14px;min-width:60px;">
        <div style="font-size:1.1rem;">${s.icon}</div>
        <div style="font-size:1.2rem;font-weight:800;">${s.val}</div>
        <div style="font-size:.7rem;opacity:.7;">${s.label}</div>
      </div>`).join('');
  } catch (e) { console.error('Admin stats error:', e); }
}

function switchAdminTab(tab) {
  adminCurrentTab = tab;
  adminCurrentPage = 1;
  adminSearchQuery = document.getElementById('adminSearchInput')?.value || '';
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  const btn = document.getElementById('adminTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (btn) btn.classList.add('active');
  loadAdminTab(tab, 1, adminSearchQuery);
}

function adminSearch() {
  adminSearchQuery = document.getElementById('adminSearchInput')?.value || '';
  clearTimeout(window._adminSearchTimer);
  window._adminSearchTimer = setTimeout(() => loadAdminTab(adminCurrentTab, 1, adminSearchQuery), 350);
}

async function loadAdminTab(tab, page, search) {
  adminCurrentPage = page;
  const content = document.getElementById('adminContent');
  if (!content) return;
  content.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af;"><i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i></div>';

  try {
    const params = new URLSearchParams({ page, limit: 20, ...(search ? { search } : {}) });
    const endpoint = tab === 'users' ? 'users' : tab === 'posts' ? 'posts' : 'shorts';
    const res = await fetch(`${API_URL}/api/admin/${endpoint}?${params}`, { headers: getAuthHeaders() });
    if (!res.ok) { content.innerHTML = '<div style="text-align:center;padding:40px;color:#e53e3e;">Access denied or error loading data.</div>'; return; }
    const data = await res.json();

    if (tab === 'users') renderAdminUsers(data.users || [], data.total || 0);
    else if (tab === 'posts') renderAdminPosts(data.posts || [], data.total || 0);
    else renderAdminShorts(data.shorts || [], data.total || 0);
  } catch (e) {
    content.innerHTML = '<div style="text-align:center;padding:40px;color:#e53e3e;">Network error.</div>';
  }
}

function renderAdminUsers(users, total) {
  const content = document.getElementById('adminContent');
  if (!users.length) { content.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af;">No users found.</div>'; return; }
  content.innerHTML = users.map(u => `
    <div class="admin-card">
      <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.1rem;flex-shrink:0;">
        ${(u.name||'?').charAt(0).toUpperCase()}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${escapeHtml(u.name)} ${u.isOwner ? '<span style="background:#fef3c7;color:#d97706;padding:1px 6px;border-radius:6px;font-size:.7rem;font-weight:800;">OWNER</span>' : ''}
        </div>
        <div style="font-size:.8rem;color:#6b7280;">${escapeHtml(u.phone||'')} · <span style="text-transform:capitalize;">${u.role}</span></div>
        <div style="font-size:.75rem;color:#9ca3af;">${u.email ? escapeHtml(u.email) : 'No email'} · Joined ${formatDate(u.createdAt)}</div>
      </div>
      ${u.isOwner ? '' : `<button class="admin-del-btn" onclick="adminDeleteUser('${u._id}','${escapeHtml(u.name)}')"><i class="fas fa-trash"></i> Delete</button>`}
    </div>`).join('');
  renderAdminPagination(total, 20, adminCurrentPage, 'users');
}

function renderAdminPosts(posts, total) {
  const content = document.getElementById('adminContent');
  if (!posts.length) { content.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af;">No posts found.</div>'; return; }
  content.innerHTML = posts.map(p => `
    <div class="admin-card">
      ${p.images && p.images[0] ? `<img src="${API_URL}${p.images[0]}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">` :
        p.videoUrl ? `<div style="width:48px;height:48px;border-radius:8px;background:#1a1a2e;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.3rem;flex-shrink:0;">🎬</div>` :
        `<div style="width:48px;height:48px;border-radius:8px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">📝</div>`}
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.title||p.caption||'Untitled')}</div>
        <div style="font-size:.8rem;color:#6b7280;">By ${escapeHtml(p.userName||'Unknown')} · ${p.postType||'post'}</div>
        <div style="font-size:.75rem;color:#9ca3af;">${(p.likes||[]).length} likes · ${(p.comments||[]).length} comments · ${formatDate(p.createdAt)}</div>
      </div>
      <button class="admin-del-btn" onclick="adminDeletePost('${p._id}','${escapeHtml((p.title||p.caption||'this post').replace(/'/g,''))}')"><i class="fas fa-trash"></i> Delete</button>
    </div>`).join('');
  renderAdminPagination(total, 20, adminCurrentPage, 'posts');
}

function renderAdminShorts(shorts, total) {
  const content = document.getElementById('adminContent');
  if (!shorts.length) { content.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af;">No shorts/status found.</div>'; return; }
  content.innerHTML = shorts.map(s => `
    <div class="admin-card">
      <div style="width:48px;height:48px;border-radius:8px;background:#1a1a2e;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.3rem;flex-shrink:0;">
        ${s.mediaType === 'video' ? '🎬' : '🖼️'}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.caption||'No caption')} <span style="background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:6px;font-size:.7rem;">${s.type}</span></div>
        <div style="font-size:.8rem;color:#6b7280;">By ${escapeHtml(s.userName||'Unknown')} · ${s.mediaType}</div>
        <div style="font-size:.75rem;color:#9ca3af;">${(s.likes||[]).length} likes · ${s.viewCount||0} views · ${formatDate(s.createdAt)}</div>
      </div>
      <button class="admin-del-btn" onclick="adminDeleteShort('${s._id}')"><i class="fas fa-trash"></i> Delete</button>
    </div>`).join('');
  renderAdminPagination(total, 20, adminCurrentPage, 'shorts');
}

function renderAdminPagination(total, limit, currentPage, tab) {
  const pages = Math.ceil(total / limit);
  const pg = document.getElementById('adminPagination');
  if (!pg || pages <= 1) { if (pg) pg.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<button onclick="loadAdminTab('${tab}',${i},'${adminSearchQuery}')" style="padding:6px 12px;border-radius:8px;border:1.5px solid ${i===currentPage?'#e53e3e':'#e5e7eb'};background:${i===currentPage?'#e53e3e':'#fff'};color:${i===currentPage?'#fff':'#374151'};font-weight:700;cursor:pointer;">${i}</button>`;
  }
  pg.innerHTML = `<span style="color:#6b7280;font-size:.85rem;align-self:center;">${total} total</span> ${html}`;
}

async function adminDeleteUser(userId, name) {
  if (!confirm(`Delete user "${name}" and ALL their content? This cannot be undone.`)) return;
  try {
    const res = await fetch(`${API_URL}/api/admin/users/${userId}`, { method: 'DELETE', headers: getAuthHeaders() });
    const data = await res.json();
    if (res.ok) {
      showAlert(`User "${name}" deleted successfully.`, 'success');
      loadAdminTab(adminCurrentTab, adminCurrentPage, adminSearchQuery);
      loadAdminStats();
    } else {
      showAlert(data.error || 'Failed to delete user');
    }
  } catch (e) { showAlert('Network error'); }
}

async function adminDeletePost(postId, title) {
  if (!confirm(`Delete post "${title}"? This cannot be undone.`)) return;
  try {
    const res = await fetch(`${API_URL}/api/admin/posts/${postId}`, { method: 'DELETE', headers: getAuthHeaders() });
    const data = await res.json();
    if (res.ok) {
      showAlert('Post deleted.', 'success');
      loadAdminTab(adminCurrentTab, adminCurrentPage, adminSearchQuery);
      loadAdminStats();
    } else {
      showAlert(data.error || 'Failed to delete post');
    }
  } catch (e) { showAlert('Network error'); }
}

async function adminDeleteShort(shortId) {
  if (!confirm('Delete this short/status? This cannot be undone.')) return;
  try {
    const res = await fetch(`${API_URL}/api/admin/shorts/${shortId}`, { method: 'DELETE', headers: getAuthHeaders() });
    const data = await res.json();
    if (res.ok) {
      showAlert('Short deleted.', 'success');
      loadAdminTab(adminCurrentTab, adminCurrentPage, adminSearchQuery);
      loadAdminStats();
    } else {
      showAlert(data.error || 'Failed to delete short');
    }
  } catch (e) { showAlert('Network error'); }
}


