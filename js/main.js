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
      var activeDropdown = link.closest(".nav-dropdown");
      if (activeDropdown) {
        var activeToggle = activeDropdown.querySelector(".nav-dropdown-toggle");
        activeDropdown.classList.add("has-active");
        if (activeToggle) {
          activeToggle.classList.add("is-active");
        }
      }
    }
  });

  var dropdowns = document.querySelectorAll(".nav-dropdown");

  function closeDropdown(dropdown) {
    var button = dropdown.querySelector(".nav-dropdown-toggle");
    dropdown.classList.remove("is-open");
    if (button) {
      button.setAttribute("aria-expanded", "false");
    }
  }

  function openDropdown(dropdown) {
    var button = dropdown.querySelector(".nav-dropdown-toggle");
    dropdown.classList.add("is-open");
    if (button) {
      button.setAttribute("aria-expanded", "true");
    }
  }

  function closeOtherDropdowns(currentDropdown) {
    dropdowns.forEach(function (dropdown) {
      if (dropdown !== currentDropdown) {
        closeDropdown(dropdown);
      }
    });
  }

  dropdowns.forEach(function (dropdown) {
    var button = dropdown.querySelector(".nav-dropdown-toggle");
    if (!button) {
      return;
    }

    button.addEventListener("click", function (event) {
      event.stopPropagation();
      var isOpen = dropdown.classList.contains("is-open");
      closeOtherDropdowns(dropdown);
      if (isOpen) {
        closeDropdown(dropdown);
        if (event.detail > 0) {
          button.blur();
        }
      } else {
        openDropdown(dropdown);
      }
    });

    dropdown.addEventListener("focusout", function (event) {
      if (!dropdown.contains(event.relatedTarget)) {
        closeDropdown(dropdown);
      }
    });

    dropdown.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeDropdown(dropdown);
        button.focus();
      }
    });
  });

  document.addEventListener("click", function (event) {
    dropdowns.forEach(function (dropdown) {
      if (!dropdown.contains(event.target)) {
        closeDropdown(dropdown);
      }
    });
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
    var pagination = document.querySelector("[data-news-pagination]");
    var archiveHeading = document.getElementById("news-archive-heading");
    var pageSize = 8;
    var currentCategory = "all";
    var currentPage = 1;

    function setCardVisible(card, shouldShow) {
      if (shouldShow) {
        card.removeAttribute("hidden");
        card.style.removeProperty("display");
      } else {
        card.setAttribute("hidden", "");
        card.style.setProperty("display", "none", "important");
      }
    }

    function pageNumbers(totalPages) {
      var pages = [];
      var page;

      if (totalPages <= 7) {
        for (page = 1; page <= totalPages; page += 1) {
          pages.push(page);
        }
        return pages;
      }

      pages.push(1);

      var startPage = Math.max(2, currentPage - 1);
      var endPage = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 4) {
        startPage = 2;
        endPage = 5;
      }

      if (currentPage >= totalPages - 3) {
        startPage = totalPages - 4;
        endPage = totalPages - 1;
      }

      if (startPage > 2) {
        pages.push("ellipsis-start");
      }

      for (page = startPage; page <= endPage; page += 1) {
        pages.push(page);
      }

      if (endPage < totalPages - 1) {
        pages.push("ellipsis-end");
      }

      pages.push(totalPages);
      return pages;
    }

    function scrollToArchiveHeading() {
      if (!archiveHeading) {
        return;
      }

      var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      archiveHeading.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start"
      });
    }

    function makePaginationButton(label, ariaLabel, disabled, onClick) {
      var button = document.createElement("button");
      button.className = "news-pagination-button";
      button.type = "button";
      button.textContent = label;
      button.disabled = Boolean(disabled);
      if (ariaLabel) {
        button.setAttribute("aria-label", ariaLabel);
      }
      if (onClick) {
        button.addEventListener("click", onClick);
      }
      return button;
    }

    function renderPagination(totalPages) {
      if (!pagination) {
        return;
      }

      pagination.replaceChildren();

      pagination.hidden = false;

      if (totalPages > 1) {
        pagination.appendChild(makePaginationButton("Previous", "Show previous news page", currentPage === 1, function () {
          applyNewsFilter(currentCategory, currentPage - 1, true);
        }));
      }

      pageNumbers(totalPages).forEach(function (page) {
        if (typeof page === "string") {
          var ellipsis = document.createElement("span");
          ellipsis.className = "news-pagination-ellipsis";
          ellipsis.textContent = "...";
          pagination.appendChild(ellipsis);
          return;
        }

        var pageButton = makePaginationButton(String(page), "Show news page " + page, false, function () {
          applyNewsFilter(currentCategory, page, true);
        });

        if (page === currentPage) {
          pageButton.classList.add("is-active");
          pageButton.setAttribute("aria-current", "page");
        }

        pagination.appendChild(pageButton);
      });

      if (totalPages > 1) {
        pagination.appendChild(makePaginationButton("Next", "Show next news page", currentPage === totalPages, function () {
          applyNewsFilter(currentCategory, currentPage + 1, true);
        }));
      }
    }

    function applyNewsFilter(selected, pageNumber, shouldScroll) {
      var selectedCategory = String(selected || "all").trim().toLowerCase();
      var matchingCards = cards.filter(function (card) {
        var category = String(card.getAttribute("data-news-category") || "").trim().toLowerCase();
        return selectedCategory === "all" || category === selectedCategory;
      });
      var totalPages = Math.max(1, Math.ceil(matchingCards.length / pageSize));
      var visibleCount = 0;
      currentCategory = selectedCategory;
      currentPage = Math.min(Math.max(Number(pageNumber) || 1, 1), totalPages);
      var firstVisible = (currentPage - 1) * pageSize;
      var lastVisible = firstVisible + pageSize;

      cards.forEach(function (card) {
        var matchIndex = matchingCards.indexOf(card);
        var shouldShow = matchIndex >= 0 && matchIndex >= firstVisible && matchIndex < lastVisible;

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
        empty.hidden = matchingCards.length !== 0;
      }

      renderPagination(totalPages);
      console.log("News filter:", selectedCategory, "visible:", visibleCount);

      if (shouldScroll) {
        scrollToArchiveHeading();
      }
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        applyNewsFilter(button.getAttribute("data-news-filter"), 1, false);
      });
    });

    applyNewsFilter("all", 1, false);
  }

  function withTimeout(promise, timeoutMs, message) {
    var timeoutId;
    var timeout = new Promise(function (_resolve, reject) {
      timeoutId = window.setTimeout(function () {
        reject(new Error(message));
      }, timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(function () {
      window.clearTimeout(timeoutId);
    });
  }

  function initNewsSubscription() {
    var form = document.querySelector("[data-news-subscribe-form]");
    if (!form) {
      return;
    }

    var status = document.querySelector("[data-news-subscribe-status]");
    var submit = form.querySelector('button[type="submit"]');
    var allowedTopics = ["academia", "quant", "creative"];

    function setStatus(message, state) {
      if (!status) {
        return;
      }
      status.textContent = message;
      status.classList.toggle("is-error", state === "error");
      status.classList.toggle("is-success", state === "success");
    }

    function selectedTopics() {
      return Array.prototype.slice.call(form.querySelectorAll('input[name="topics"]:checked'))
        .map(function (input) {
          return input.value;
        })
        .filter(function (value) {
          return allowedTopics.indexOf(value) !== -1;
        });
    }

    function normalizedEmail() {
      var emailField = form.elements.email;
      return emailField ? emailField.value.trim().toLowerCase() : "";
    }

    function isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function setFormEnabled(enabled) {
      Array.prototype.slice.call(form.elements).forEach(function (element) {
        element.disabled = !enabled;
      });
      if (submit) {
        submit.textContent = enabled ? "Subscribe" : "Saving...";
      }
    }

    form.addEventListener("input", function () {
      setStatus("", "");
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var honeypot = form.elements.website;
      if (honeypot && honeypot.value.trim()) {
        form.reset();
        setStatus("Thanks - your subscription was saved.", "success");
        return;
      }

      var email = normalizedEmail();
      var topics = selectedTopics();

      if (!isValidEmail(email)) {
        setStatus("Please enter a valid email address.", "error");
        return;
      }

      if (!topics.length) {
        setStatus("Please choose at least one topic.", "error");
        return;
      }

      if (!window.SiteSupabase || !window.SiteSupabase.getClient) {
        setStatus("Subscription service is temporarily unavailable. Please try again later.", "error");
        return;
      }

      var client;
      try {
        client = window.SiteSupabase.getClient();
      } catch (error) {
        console.error("News subscription: Supabase initialization failed", error);
        setStatus("Subscription service is temporarily unavailable. Please try again later.", "error");
        return;
      }

      setStatus("Saving...", "");
      setFormEnabled(false);

      withTimeout(
        client.rpc("submit_news_subscription", {
          subscriber_email: email,
          selected_topics: topics
        }),
        12000,
        "Supabase subscription request timed out"
      )
        .then(function (result) {
          if (result.error) {
            throw result.error;
          }

          form.reset();
          setStatus("Thanks - your subscription was saved.", "success");
        })
        .catch(function (error) {
          console.error("News subscription: submit failed", error);
          setStatus(
            "Sorry, the subscription could not be saved" + (error && error.message ? ": " + error.message : ". Please try again later."),
            "error"
          );
        })
        .finally(function () {
          setFormEnabled(true);
        });
    });
  }

  function initPageInteractions() {
    initNewsFilter();
    initNewsSubscription();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPageInteractions);
  } else {
    initPageInteractions();
  }
})();
