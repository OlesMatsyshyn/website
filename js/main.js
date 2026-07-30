(function () {
  var year = document.getElementById("year");
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var isOpen = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  var path = window.location.pathname.split("/").pop() || "index.html";
  var navLinks = document.querySelectorAll(".nav-links a");
  navLinks.forEach(function (link) {
    var href = link.getAttribute("href");
    if (href === path) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }
  });

  var spreadViewers = document.querySelectorAll("[data-spread-viewer]");
  spreadViewers.forEach(function (viewer) {
    var image = viewer.querySelector("[data-spread-image]");
    var previous = viewer.querySelector("[data-spread-prev]");
    var next = viewer.querySelector("[data-spread-next]");
    var status = viewer.querySelector("[data-spread-status]");
    var items = Array.prototype.map.call(viewer.querySelectorAll(".spread-data [data-src]"), function (item) {
      return {
        src: item.getAttribute("data-src"),
        alt: item.getAttribute("data-alt") || ""
      };
    });
    var index = 0;

    function updateSpread(nextIndex) {
      if (!image || !status || !items.length) {
        return;
      }
      index = (nextIndex + items.length) % items.length;
      image.src = items[index].src;
      image.alt = items[index].alt;
      status.textContent = String(index + 1) + " / " + String(items.length);
    }

    if (previous && next && image && items.length) {
      previous.addEventListener("click", function () {
        updateSpread(index - 1);
      });
      next.addEventListener("click", function () {
        updateSpread(index + 1);
      });
      updateSpread(0);
    }
  });

  function initNewsFilter() {
    var filterRoot = document.querySelector(".news-filter");
    if (!filterRoot) {
      return;
    }

    var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-news-filter]"));
    var cards = Array.prototype.slice.call(document.querySelectorAll(".news-card[data-news-category]"));
    var empty = document.querySelector(".news-filter-empty");

    function setCardVisible(card, shouldShow) {
      if (shouldShow) {
        card.removeAttribute("hidden");
        card.style.removeProperty("display");
      } else {
        card.setAttribute("hidden", "");
        card.style.setProperty("display", "none", "important");
      }
    }

    function applyNewsFilter(selected) {
      var selectedCategory = String(selected || "all").trim().toLowerCase();
      var visibleCount = 0;

      cards.forEach(function (card) {
        var category = String(card.getAttribute("data-news-category") || "").trim().toLowerCase();
        var shouldShow = selectedCategory === "all" || category === selectedCategory;

        setCardVisible(card, shouldShow);

        if (shouldShow) {
          visibleCount += 1;
        }
      });

      buttons.forEach(function (button) {
        var buttonCategory = String(button.getAttribute("data-news-filter") || "").trim().toLowerCase();
        var isActive = buttonCategory === selectedCategory;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });

      if (empty) {
        empty.hidden = visibleCount !== 0;
      }

      console.log("News filter:", selectedCategory, "visible:", visibleCount);
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        applyNewsFilter(button.getAttribute("data-news-filter"));
      });
    });

    applyNewsFilter("all");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNewsFilter);
  } else {
    initNewsFilter();
  }
})();
