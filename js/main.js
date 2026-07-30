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

  var newsFilter = document.querySelector(".news-filter");
  if (newsFilter) {
    var filterButtons = document.querySelectorAll("[data-news-filter]");
    var newsCards = document.querySelectorAll("[data-news-category]");
    var emptyMessage = document.querySelector(".news-filter-empty");

    filterButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var selected = button.getAttribute("data-news-filter") || "all";
        var visibleCount = 0;

        filterButtons.forEach(function (filterButton) {
          filterButton.classList.toggle("is-active", filterButton === button);
        });

        newsCards.forEach(function (card) {
          var shouldShow = selected === "all" || card.getAttribute("data-news-category") === selected;
          card.hidden = !shouldShow;
          if (shouldShow) {
            visibleCount += 1;
          }
        });

        if (emptyMessage) {
          emptyMessage.hidden = visibleCount > 0;
        }
      });
    });
  }
})();
