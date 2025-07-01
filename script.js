// AUTO-UPDATING EXPERIENCE YEARS CALCULATOR
// Calculate years of experience since September 2016
function updateExperienceYears() {
    const startDate = new Date('2016-09-01'); // September 1, 2016 - adjust if needed
    const currentDate = new Date();
    const millisecondsPerYear = 365.25 * 24 * 60 * 60 * 1000; // Accounts for leap years
    const yearsDiff = Math.floor((currentDate - startDate) / millisecondsPerYear);
    
    // Update the HTML element with id="years-experience"
    const experienceElement = document.getElementById('years-experience');
    if (experienceElement) {
        experienceElement.textContent = yearsDiff + '+ Years Experience';
    }
}

// TOOLS SECTION FADE-IN ANIMATION
// This creates a fade-in effect for tool items as they come into view
function initToolsAnimation() {
    const toolItems = document.querySelectorAll('.tool-item');
    
    // Set initial opacity to 0 for animation
    toolItems.forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        item.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });
    
    // Create intersection observer to trigger animation when tools come into view
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Add delay for staggered effect
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 100); // 100ms delay between each item
                
                // Stop observing once animated
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1 // Trigger when 10% of element is visible
    });
    
    // Start observing each tool item
    toolItems.forEach(item => {
        observer.observe(item);
    });
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Contact form handling with popup
document.querySelector('.contact-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    
    try {
        const response = await fetch(this.action, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            // Success modal
            const modal = document.createElement('div');
            modal.innerHTML = `
              <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 2rem; border-radius: 8px; max-width: 400px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                  <h3 style="margin: 0 0 1rem 0; color: #2563eb;">Thank you!</h3>
                  <p style="margin: 0 0 1.5rem 0; color: #374151;">Your message has been sent. I'll respond within 4 hours during business days.</p>
                  <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">OK</button>
                </div>
              </div>
            `;
            document.body.appendChild(modal);
            this.reset(); // Clear the form
        } else {
            // Error modal
            const modal = document.createElement('div');
            modal.innerHTML = `
              <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 2rem; border-radius: 8px; max-width: 400px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                  <h3 style="margin: 0 0 1rem 0; color: #dc2626;">Error</h3>
                  <p style="margin: 0 0 1.5rem 0; color: #374151;">There was an error sending your message. Please try again or contact me on LinkedIn: <a href="https://linkedin.com/in/jddeleon" target="_blank" style="color: #2563eb;">linkedin.com/in/jddeleon</a></p>
                  <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">OK</button>
                </div>
              </div>
            `;
            document.body.appendChild(modal);
        }
    } catch (error) {
        console.error('Form submission error:', error);
        // Same error modal as above
        const modal = document.createElement('div');
        modal.innerHTML = `
          <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 2rem; border-radius: 8px; max-width: 400px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
              <h3 style="margin: 0 0 1rem 0; color: #dc2626;">Error</h3>
              <p style="margin: 0 0 1.5rem 0; color: #374151;">There was an error sending your message. Please try again or contact me on LinkedIn: <a href="https://linkedin.com/in/jddeleon" target="_blank" style="color: #2563eb;">linkedin.com/in/jddeleon</a></p>
              <button onclick="this.closest('div').parentElement.remove()" style="padding: 0.75rem 1.5rem; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">OK</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
    }
});

// Navbar background on scroll
window.addEventListener('scroll', function() {
    const nav = document.querySelector('.nav');
    if (window.scrollY > 50) {
        nav.style.background = 'rgba(255, 255, 255, 0.95)';
        nav.style.backdropFilter = 'blur(10px)';
    } else {
        nav.style.background = 'var(--background)';
        nav.style.backdropFilter = 'none';
    }
});

// Add intersection observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Mobile menu toggle
function toggleMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    navMenu.classList.toggle('active');
}

// DOM Content Loaded - Initialize everything
document.addEventListener('DOMContentLoaded', function() {
    // Initialize auto-updating years and tools animation
    updateExperienceYears();
    initToolsAnimation();
    
    // Observe all sections for scroll animations
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });
    
    // Make hero visible immediately
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.style.opacity = '1';
        hero.style.transform = 'translateY(0)';
    }
    
    // Add hamburger menu to navigation
    const navContainer = document.querySelector('.nav-container');
    const hamburger = document.createElement('div');
    hamburger.className = 'hamburger';
    hamburger.innerHTML = '<span></span><span></span><span></span>';
    hamburger.addEventListener('click', toggleMobileMenu);
    navContainer.appendChild(hamburger);
    
    // Close mobile menu when clicking nav links
    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const navMenu = document.querySelector('.nav-menu');
            navMenu.classList.remove('active');
        });
    });
});