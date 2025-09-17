// static/js/theme-toggle.js

document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('theme-toggle');
    const body = document.body;
    const icon = toggleButton.querySelector('i');

    const setIcons = (isDarkMode) => {
        if (isDarkMode) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            toggleButton.textContent = ' Mode sombre';
            toggleButton.prepend(icon);
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            toggleButton.textContent = ' Mode clair';
            toggleButton.prepend(icon);
        }
    };

    // Vérifie le thème stocké dans le localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
        setIcons(true);
    } else {
        setIcons(false);
    }

    // Gère le clic sur le bouton
    toggleButton.addEventListener('click', () => {
        const isDarkMode = body.classList.toggle('dark-mode');
        setIcons(isDarkMode);
        
        // Sauvegarde le choix de l'utilisateur
        if (isDarkMode) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });
});