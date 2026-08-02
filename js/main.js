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

  function initVyrvaCharacterShowcase() {
    var showcase = document.querySelector("[data-vyrva-character-showcase]");
    if (!showcase) {
      return;
    }

    var image = showcase.querySelector("[data-vyrva-character-image]");
    var status = showcase.querySelector("[data-vyrva-character-status]");
    var name = showcase.querySelector("[data-vyrva-character-name]");
    var archetype = showcase.querySelector("[data-vyrva-character-archetype]");
    var description = showcase.querySelector("[data-vyrva-character-description]");
    var skillsRegion = showcase.querySelector("[data-vyrva-character-skills]");
    var card = showcase.querySelector("[data-vyrva-character-card]");
    var previous = showcase.querySelector("[data-vyrva-character-prev]");
    var next = showcase.querySelector("[data-vyrva-character-next]");
    var indicators = Array.prototype.slice.call(showcase.querySelectorAll("[data-character-index]"));
    var currentIndex = 0;

    if (!image || !status || !name || !archetype || !description || !skillsRegion || !card) {
      return;
    }

    var characters = [
      {
        id: "kharakternyk",
        name: "The Kharakternyk",
        archetype: "Cossack mystic and unwelcome protector",
        image: "img/vyrva/vyrva-kharakternyk-portrait.png",
        imageWidth: 512,
        imageHeight: 512,
        imageAlt: "Portrait concept of the Kharakternyk, a Cossack mystic in Vyrva.",
        layout: "portrait",
        status: "First playable archetype in development",
        description: [
          "He was born in the wide yellow steppe beneath blue skies, far from the drowned streets of Vyrva.",
          "In battle, people saw him move too quickly, endure too much, and strike with strength that did not look natural. Some called it skill. Others whispered another word: Kharakternyk.",
          "He did not come to Vyrva for gold or glory. He came because others called for help. But the moment he stepped into the city, something changed.",
          "In ordinary places, fear remains only fear. In Vyrva, fear has weight. Words, dreams, rumors, and old stories can become as real as an apple on a tree.",
          "The enemies who once feared the Kharakternyk imagined what he could become. In Vyrva, those fears began to answer.",
          "Every power in Vyrva is useful. Every power is also a debt. Now he owes the Mist, and the Mist does not let debtors choose when the debt is paid."
        ],
        skills: [
          {
            key: "Q",
            icon: "img/vyrva/vyrva-skill-q-card-throw.png",
            iconAlt: "Card Throw ability icon.",
            title: "Card Throw",
            text: "A true Cossack never runs out of cards. Throw a fan of enchanted cards through enemies in front of him."
          },
          {
            key: "W",
            icon: "img/vyrva/vyrva-skill-w-invisibility.png",
            iconAlt: "Invisibility ability icon.",
            title: "Invisibility",
            text: "Cloud the sight of the living and the dead. The Kharakternyk slips from view, crosses danger unseen, and strikes before his presence is understood."
          },
          {
            key: "E",
            icon: "img/vyrva/vyrva-skill-e-hopak-leap.png",
            iconAlt: "Hopak Leap ability icon.",
            title: "Hopak Leap",
            text: "When a Cossack dances, even the ground answers. Leap into the chosen area; the landing shakes the earth and staggers nearby enemies."
          },
          {
            key: "R",
            icon: "img/vyrva/vyrva-skill-r-ancestral-fury.png",
            iconAlt: "Ancestral Fury ability icon.",
            title: "Ancestral Fury",
            text: "Draw strength from the land and from those who defended it before. Enter a furious state that overwhelms nearby enemies. Souls claimed during the fury are drawn into the ancestral storm."
          }
        ]
      },
      {
        id: "undead-cossack-shooter",
        name: "Undead Cossack Shooter",
        archetype: "Crimson-eyed revenant and relentless marksman",
        image: "img/vyrva/vyrva-undead-cossack-shooter.png",
        imageWidth: 1448,
        imageHeight: 1086,
        imageAlt: "Undead Cossack marksman overlooking Vyrva at crimson sunset",
        layout: "landscape",
        status: "Character concept in development",
        description: [
          "He pursued the remnants of an invading army with a fury born from what they had left behind. Almost none escaped him, but three crossed the river above Vyrva.",
          "Exhausted and wounded, he followed and disappeared beneath the water. When one of the fugitives later saw his body drifting nearby, terror gave the reflection in his missing eye the color of a crimson sunset.",
          "In Vyrva, fear can give substance to the impossible. Something returned in the warrior's body, and it has begun its hunt with the three who escaped him."
        ],
        gameplayNote: "Concept note: a ranged character intended to support the normal elevated strategy view and a closer aiming view.",
        skills: []
      },
      {
        id: "iron-lady",
        name: "Iron Lady",
        archetype: "Cursed protector, tank, and support",
        image: "img/vyrva/vyrva-iron-lady.png",
        imageWidth: 1448,
        imageHeight: 1086,
        imageAlt: "The Iron Lady standing in a ruined chapel courtyard",
        layout: "landscape",
        status: "Character concept in development",
        description: [
          "Hearing that the common people of Vyrva were suffering, she entered the city to restore faith, order, and hope.",
          "Vyrva transformed that devotion into a terrible burden. Sealed behind an iron mask and heavy devotional armor, she carries a supernatural torment that manifests as heat beneath the metal and an oppressive presence around her.",
          "She came to relieve the suffering of others. Now she must protect them from the curse that travels with her."
        ],
        gameplayNote: "Concept note: a tank and support archetype built around protection, endurance, and an aura that can help allies while burdening everyone nearby.",
        skills: []
      },
      {
        id: "nightmare-bane",
        name: "Nightmare Bane",
        archetype: "Demonic rider and living siege charge",
        image: "img/vyrva/vyrva-nightmare-bane.png",
        imageWidth: 1448,
        imageHeight: 1086,
        imageAlt: "Nightmare Bane riding a two-headed supernatural horse",
        layout: "landscape",
        status: "Character concept in development",
        description: [
          "Nightmare Bane rides a creature that should not be able to move: one immense horse with two heads and six legs, carrying its silent master through the drowned outskirts of Vyrva.",
          "Once the charge begins, their momentum becomes a weapon. Yet the same mass that makes them devastating also makes every turn, obstacle, and mistake dangerous.",
          "The rider is less a duelist than a force that must choose its direction before the battlefield can react."
        ],
        gameplayNote: "Concept note: a mounted momentum archetype with great speed and impact damage, counterbalanced by wide turns, heavy inertia, and more difficult control.",
        skills: []
      }
    ];

    function createTextElement(tagName, className, text) {
      var element = document.createElement(tagName);
      if (className) {
        element.className = className;
      }
      element.textContent = text;
      return element;
    }

    function renderDescription(character) {
      description.replaceChildren();

      if (character.layout !== "portrait") {
        return;
      }

      character.description.forEach(function (text) {
        description.appendChild(createTextElement("p", "", text));
      });

      if (character.gameplayNote) {
        description.appendChild(createTextElement("p", "vyrva-gameplay-note", character.gameplayNote));
      }
    }

    function renderSkills(character) {
      skillsRegion.replaceChildren();

      if (!character.skills.length) {
        skillsRegion.setAttribute("aria-label", character.name + " story");
        var story = document.createElement("article");
        story.className = "vyrva-character-story-card";

        character.description.forEach(function (text) {
          story.appendChild(createTextElement("p", "", text));
        });

        if (character.gameplayNote) {
          story.appendChild(createTextElement("p", "vyrva-gameplay-note", character.gameplayNote));
        }

        story.appendChild(createTextElement("p", "vyrva-character-power-status", "Vyrva has not yet decided what powers to grant."));
        skillsRegion.appendChild(story);
        return;
      }

      skillsRegion.setAttribute("aria-label", character.name + " skills");
      var grid = document.createElement("div");
      grid.className = "vyrva-ability-grid";
      grid.setAttribute("aria-label", character.name + " ability set");

      character.skills.forEach(function (skill) {
        var card = document.createElement("article");
        card.className = "vyrva-ability-card";

        var key = document.createElement("kbd");
        key.textContent = skill.key;

        var icon = document.createElement("img");
        icon.src = skill.icon;
        icon.width = 512;
        icon.height = 512;
        icon.loading = "lazy";
        icon.alt = skill.iconAlt;

        var copy = document.createElement("div");
        copy.className = "vyrva-ability-copy";
        copy.appendChild(createTextElement("h3", "", skill.title));
        copy.appendChild(createTextElement("p", "", skill.text));

        card.appendChild(key);
        card.appendChild(icon);
        card.appendChild(copy);
        grid.appendChild(card);
      });

      skillsRegion.appendChild(grid);
    }

    function updateIndicators() {
      indicators.forEach(function (indicator, index) {
        var isActive = index === currentIndex;
        indicator.classList.toggle("is-active", isActive);
        if (isActive) {
          indicator.setAttribute("aria-current", "true");
        } else {
          indicator.removeAttribute("aria-current");
        }
      });
    }

    function showCharacter(nextIndex) {
      currentIndex = (nextIndex + characters.length) % characters.length;
      var character = characters[currentIndex];

      card.classList.toggle("is-portrait", character.layout === "portrait");
      card.classList.toggle("is-landscape", character.layout === "landscape");
      image.src = character.image;
      image.width = character.imageWidth;
      image.height = character.imageHeight;
      image.alt = character.imageAlt;
      status.hidden = character.layout !== "portrait";
      status.textContent = character.layout === "portrait" ? character.status : "";
      name.textContent = character.name;
      archetype.textContent = character.archetype;
      renderDescription(character);
      renderSkills(character);
      updateIndicators();
    }

    if (previous) {
      previous.addEventListener("click", function () {
        showCharacter(currentIndex - 1);
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        showCharacter(currentIndex + 1);
      });
    }

    indicators.forEach(function (indicator) {
      indicator.addEventListener("click", function () {
        showCharacter(Number(indicator.getAttribute("data-character-index")) || 0);
      });
    });

    showcase.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showCharacter(currentIndex - 1);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showCharacter(currentIndex + 1);
      }
    });
  }

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
    var forms = Array.prototype.slice.call(document.querySelectorAll("[data-news-subscribe-form], [data-vyrva-subscribe-form], [data-subscribe-form]"));
    if (!forms.length) {
      return;
    }

    var allowedTopics = ["academia", "quant", "creative"];

    forms.forEach(function (form) {
      var status = form.querySelector("[data-news-subscribe-status], [data-vyrva-subscribe-status], [data-subscribe-status]");
      var submit = form.querySelector('button[type="submit"]');
      var submitLabel = submit ? submit.textContent : "Subscribe";
      var isSaving = false;

      function editableEmailField() {
        var emailField = form.elements.email || form.querySelector('input[type="email"], input[name="email"]');
        if (!emailField) {
          return null;
        }

        if (emailField.tagName === "INPUT") {
          emailField.type = "email";
        }
        emailField.readOnly = false;
        emailField.removeAttribute("readonly");
        emailField.removeAttribute("aria-readonly");
        emailField.removeAttribute("disabled");
        emailField.disabled = false;
        return emailField;
      }

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
        var emailField = editableEmailField();
        return emailField ? emailField.value.trim().toLowerCase() : "";
      }

      function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      }

      function setSaving(saving) {
        isSaving = saving;
        if (submit) {
          submit.disabled = saving;
          submit.textContent = saving ? "Saving..." : submitLabel;
        }
        editableEmailField();
      }

      editableEmailField();

      form.addEventListener("input", function () {
        setStatus("", "");
      });

      form.addEventListener("submit", function (event) {
        event.preventDefault();

        if (isSaving) {
          return;
        }

        var honeypot = form.elements.website;
        if (honeypot && honeypot.value.trim()) {
          form.reset();
          editableEmailField();
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
        setSaving(true);

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
            editableEmailField();
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
            setSaving(false);
          });
      });
    });
  }

  function initPageInteractions() {
    initNewsPagination();
    initNewsSubscription();
    initVyrvaCharacterShowcase();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPageInteractions);
  } else {
    initPageInteractions();
  }
})();
