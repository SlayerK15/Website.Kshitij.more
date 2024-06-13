document.addEventListener('DOMContentLoaded', (event) => {
    const images = [
        'url("stock/forweb/1.jpg")',
        'url("stock/forweb/2.jpg")',
        'url("stock/forweb/3.jpg")',
        'url("stock/forweb/4.jpg")',
        'url("stock/forweb/5.jpg")',
        'url("stock/forweb/6.jpg")',
        'url("stock/forweb/7.jpg")',
        'url("stock/forweb/8.jpg")',
        'url("stock/forweb/9.jpg")',
        'url("stock/forweb/10.jpg")',
        'url("stock/forweb/11.jpg")',
        'url("stock/forweb/12.jpg")',
        'url("stock/forweb/13.jpg")',
        'url("stock/forweb/14.jpg")',
        'url("stock/forweb/15.jpg")',
        'url("stock/forweb/16.jpg")',
    ];

    let currentIndex = 0;

    function changeBackground() {
        const slideshowElement = document.querySelector('.background-slideshow');
        slideshowElement.style.backgroundImage = images[currentIndex];
        currentIndex = (currentIndex + 1) % images.length;
    }

    setInterval(changeBackground, 5000); // Change background every 5 seconds

    // Initial call to set the first image
    changeBackground();
});