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

// Contact form handling
// document.querySelector('.contact-form').addEventListener('submit', function(e) {
//     e.preventDefault();
    
//     // Get form data
//     const formData = new FormData(this);
//     const data = {
//         name: formData.get('name'),
//         email: formData.get('email'),
//         company: formData.get('company'),
//         service: formData.get('service'),
//         message: formData.get('message')
//     };
    
//     // Simple validation
//     if (!data.name || !data.email || !data.message || !data.service) {
//         alert('Please fill in all required fields.');
//         return;
//     }
    
//     // For now, create a mailto link (replace with actual form handling later)
//     const subject = `Audio Production Inquiry - ${data.service}`;
//     const body = `Name: ${data.name}
// Email: ${data.email}
// Company: ${data.company || 'Not specified'}
// Service: ${data.service}

// Message:
// ${data.message}`;
    
//     const mailtoLink = `mailto:jon@jondeleonmedia.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
//     // Open email client
//     window.location.href = mailtoLink;
    
//     // Show confirmation
//     alert('Thank you! Your email client should open with the message. If not, please email jon@jondeleonmedia.com directly.');
    
//     // Reset form
//     this.reset();
// });

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
            alert('Thank you! Your message has been sent. I\'ll respond within 4 hours during business days.');
            this.reset(); // Clear the form
        } else {
            alert('There was an error sending your message. Please try again or contact me on LinkedIn: linkedin.com/in/jddeleon');
        }
    } catch (error) {
        console.error('Form submission error:', error);
        alert('There was an error sending your message. Please try again or contact me on LinkedIn: linkedin.com/in/jddeleon');
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

// Observe all sections for scroll animations
document.addEventListener('DOMContentLoaded', function() {
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
});

// Mobile menu toggle
function toggleMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    navMenu.classList.toggle('active');
}

// Add hamburger menu to navigation
document.addEventListener('DOMContentLoaded', function() {
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