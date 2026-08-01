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

  function initNewsPagination() {
    var cards = Array.prototype.slice.call(document.querySelectorAll(".news-entry-card"));
    var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-news-filter]"));
    var pagination = document.querySelector("[data-news-pagination]");
    var archiveHeading = document.getElementById("news-archive-heading");
    var pageSize = 8;
    var currentCategory = "all";
    var currentPage = 1;

    if (!cards.length || !pagination) {
      return;
    }

    var allowedCategories = buttons.map(function (button) {
      return String(button.getAttribute("data-news-filter") || "").trim().toLowerCase();
    });

    function setCardVisible(card, shouldShow) {
      if (shouldShow) {
        card.removeAttribute("hidden");
        card.style.removeProperty("display");
      } else {
        card.setAttribute("hidden", "");
        card.style.setProperty("display", "none", "important");
      }
    }

    function normalizeCategory(rawCategory) {
      var category = String(rawCategory || "all").trim().toLowerCase();
      return allowedCategories.indexOf(category) !== -1 ? category : "all";
    }

    function matchingCards(category) {
      return cards.filter(function (card) {
        var cardCategory = String(card.getAttribute("data-news-category") || "").trim().toLowerCase();
        return category === "all" || cardCategory === category;
      });
    }

    function stateFromUrl() {
      var params = new URLSearchParams(window.location.search);
      var rawCategory = params.get("category");
      var category = normalizeCategory(rawCategory);

      if (rawCategory && category !== String(rawCategory).trim().toLowerCase()) {
        return {
          category: "all",
          page: 1
        };
      }

      var matches = matchingCards(category);
      var totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
      var pageParam = params.get("page");
      var rawPage = pageParam === null || pageParam === "" ? 1 : Number(pageParam);

      if (!Number.isInteger(rawPage) || rawPage < 1 || rawPage > totalPages) {
        return {
          category: "all",
          page: 1
        };
      }

      return {
        category: category,
        page: rawPage
      };
    }

    function updatePageUrl(category, page) {
      var url = new URL(window.location.href);

      if (category === "all") {
        url.searchParams.delete("category");
      } else {
        url.searchParams.set("category", category);
      }

      if (page <= 1) {
        url.searchParams.delete("page");
      } else {
        url.searchParams.set("page", String(page));
      }

      window.history.pushState({ newsCategory: category, newsPage: page }, "", url);
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
      pagination.replaceChildren();

      pagination.hidden = totalPages <= 1;

      if (totalPages <= 1) {
        return;
      }

      pagination.appendChild(makePaginationButton("Previous", "Show previous news page", currentPage === 1, function () {
        applyNewsPage(currentCategory, currentPage - 1, true, true);
      }));

      pageNumbers(totalPages).forEach(function (page) {
        if (typeof page === "string") {
          var ellipsis = document.createElement("span");
          ellipsis.className = "news-pagination-ellipsis";
          ellipsis.textContent = "...";
          pagination.appendChild(ellipsis);
          return;
        }

        var pageButton = makePaginationButton(String(page), "Show news page " + page, false, function () {
          applyNewsPage(currentCategory, page, true, true);
        });

        if (page === currentPage) {
          pageButton.classList.add("is-active");
          pageButton.setAttribute("aria-current", "page");
        }

        pagination.appendChild(pageButton);
      });

      pagination.appendChild(makePaginationButton("Next", "Show next news page", currentPage === totalPages, function () {
        applyNewsPage(currentCategory, currentPage + 1, true, true);
      }));
    }

    function updateFilterButtons(category) {
      buttons.forEach(function (button) {
        var buttonCategory = String(button.getAttribute("data-news-filter") || "").trim().toLowerCase();
        var isActive = buttonCategory === category;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    }

    function applyNewsPage(category, pageNumber, shouldUpdateUrl, shouldScroll) {
      var selectedCategory = normalizeCategory(category);
      var matches = matchingCards(selectedCategory);
      var totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
      currentPage = Math.min(Math.max(Number(pageNumber) || 1, 1), totalPages);
      currentCategory = selectedCategory;
      var firstVisible = (currentPage - 1) * pageSize;
      var lastVisible = firstVisible + pageSize;

      cards.forEach(function (card) {
        var matchIndex = matches.indexOf(card);
        setCardVisible(card, matchIndex >= firstVisible && matchIndex < lastVisible);
      });

      updateFilterButtons(currentCategory);
      renderPagination(totalPages);

      if (shouldUpdateUrl) {
        updatePageUrl(currentCategory, currentPage);
      }

      if (shouldScroll) {
        scrollToArchiveHeading();
      }
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        applyNewsPage(button.getAttribute("data-news-filter"), 1, true, true);
      });
    });

    window.addEventListener("popstate", function () {
      var state = stateFromUrl();
      applyNewsPage(state.category, state.page, false, false);
    });

    var initialState = stateFromUrl();
    applyNewsPage(initialState.category, initialState.page, false, false);
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
    initNewsPagination();
    initNewsSubscription();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPageInteractions);
  } else {
    initPageInteractions();
  }
})();
