document.addEventListener("DOMContentLoaded", () => {
  const hamburger = document.getElementById("hamburger");
  const mobileMenu = document.getElementById("mobileMenu");
  const closeMenu = document.getElementById("closeMenu");

  if (!hamburger || !mobileMenu) return;

  const openMenu = () => {
    mobileMenu.style.display = "flex";
  };

  const hideMenu = () => {
    mobileMenu.style.display = "none";
  };

  hamburger.addEventListener("click", openMenu);
  closeMenu?.addEventListener("click", hideMenu);
});

