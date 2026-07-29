(function () {
  "use strict";

  var SUPABASE_URL = "https://eewmeannakelztffftaf.supabase.co";
  var SUPABASE_PUBLIC_KEY = "sb_publishable_CC1tYHFA5ho8aHjj-KQ0oQ_UDAZPeAH";
  var PAGE_SLUG = "public-outreach";
  var MAX_APPROVED_COMMENTS = 100;
  var ALLOWED_CHAPTERS = new Set([
    "superball",
    "yoyo",
    "cartesian-diver",
    "solar-system-scale"
  ]);

  window.OutreachCommentsDebug = {
    events: [],
    errors: []
  };

  var threads = Array.from(document.querySelectorAll("[data-comments-thread]"));

  function debugEvent(message) {
    window.OutreachCommentsDebug.events.push(message);
    console.log(message);
  }

  function describeError(error) {
    if (!error) {
      return "";
    }

    if (typeof error === "string") {
      return error;
    }

    return [
      error.message,
      error.code ? "code: " + error.code : "",
      error.details ? "details: " + error.details : "",
      error.hint ? "hint: " + error.hint : "",
      error.status ? "status: " + error.status : "",
      error.name ? "name: " + error.name : ""
    ].filter(Boolean).join(" | ") || JSON.stringify(error);
  }

  function debugError(message, error) {
    var detail = describeError(error);
    var fullMessage = message + (detail ? ": " + detail : "");
    window.OutreachCommentsDebug.errors.push(fullMessage);
    console.error(fullMessage);
  }

  console.log("Comments: Supabase URL", SUPABASE_URL);
  console.log("Comments: Supabase key present", Boolean(SUPABASE_PUBLIC_KEY));
  console.log("Comments: Supabase key prefix", SUPABASE_PUBLIC_KEY.slice(0, 16));
  debugEvent("Comments: found " + threads.length + " discussion containers");


  if (!threads.length) {
    return;
  }

  function getPart(thread, selector) {
    return thread.querySelector(selector);
  }

  function getToggle(thread) {
    return getPart(thread, "[data-comments-toggle]");
  }

  function getPanel(thread) {
    return getPart(thread, "[data-comments-panel]");
  }

  function setText(element, text) {
    if (element) {
      element.textContent = text;
    }
  }

  function setFormEnabled(thread, enabled) {
    var form = getPart(thread, "[data-comments-form]");
    if (!form) {
      return;
    }

    Array.from(form.elements).forEach(function (element) {
      element.disabled = !enabled;
    });

    updateSubmitState(thread);
  }

  function setUnavailable(thread, message) {
    thread.classList.add("comments-unavailable");
    setFormEnabled(thread, false);
    setText(getPart(thread, "[data-comments-service-state]"), message);
  }

  function setAllUnavailable(message, reason) {
    debugError("Comments: " + reason);
    threads.forEach(function (thread) {
      setUnavailable(thread, message);
    });
  }

  function setAvailable(thread) {
    thread.classList.remove("comments-unavailable");
    setText(getPart(thread, "[data-comments-service-state]"), "Comments are reviewed before publication.");
    setFormEnabled(thread, true);
  }

  function setStatus(thread, message) {
    setText(getPart(thread, "[data-comments-status]"), message);
  }

  function setExpanded(thread, expanded, client) {
    var panel = getPanel(thread);
    var toggle = getToggle(thread);

    thread.classList.toggle("comments-collapsed", !expanded);

    if (panel) {
      panel.hidden = !expanded;
    }

    if (toggle) {
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.textContent = expanded ? "Hide chapter comments" : "Show chapter comments";
    }

    if (
      expanded &&
      client &&
      thread.dataset.commentsLoaded !== "true" &&
      thread.dataset.commentsLoading !== "true" &&
      !thread.classList.contains("comments-unavailable")
    ) {
      loadComments(thread, client);
    }
  }

  function formatDate(dateString) {
    if (!dateString) {
      return "";
    }

    var date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function commentCountText(count) {
    if (count === 1) {
      return "1 published comment";
    }
    return count + " published comments";
  }

  function createTextElement(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    element.textContent = text;
    return element;
  }

  function commentLabel(comment, fallbackLabel) {
    if (fallbackLabel) {
      return fallbackLabel;
    }

    return comment.comment_type === "question" ? "Question" : "";
  }

  function appendCommentMeta(container, comment, labelText) {
    var meta = document.createElement("p");
    meta.className = "comment-meta";

    if (labelText) {
      meta.appendChild(createTextElement("span", "comment-type-label", labelText));
    }
    meta.appendChild(createTextElement("span", "comment-name", comment.name || "Anonymous"));

    var dateText = formatDate(comment.created_at);
    if (dateText) {
      var time = document.createElement("time");
      time.dateTime = comment.created_at;
      time.textContent = dateText;
      meta.appendChild(time);
    }

    container.appendChild(meta);
  }

  function appendCommentBody(container, comment) {
    container.appendChild(createTextElement("p", "comment-body", comment.comment_text || ""));
  }

  function renderReply(comment) {
    var reply = document.createElement("article");
    reply.className = "comment-item comment-item-reply";
    appendCommentMeta(reply, comment, "Reply");
    appendCommentBody(reply, comment);
    return reply;
  }

  function renderTopLevelComment(thread, client, comment, replies) {
    var item = document.createElement("article");
    item.className = "comment-item comment-item-top";

    appendCommentMeta(item, comment, commentLabel(comment));
    appendCommentBody(item, comment);

    var repliesWrap = document.createElement("div");
    repliesWrap.className = "comment-replies";

    replies.forEach(function (reply) {
      repliesWrap.appendChild(renderReply(reply));
    });

    item.appendChild(repliesWrap);

    var actions = document.createElement("div");
    actions.className = "comment-actions";

    var replyButton = document.createElement("button");
    replyButton.className = "text-button comment-reply-toggle";
    replyButton.type = "button";
    replyButton.textContent = "Reply";
    actions.appendChild(replyButton);

    var replyFormSlot = document.createElement("div");
    replyFormSlot.className = "comment-reply-slot";

    replyButton.addEventListener("click", function () {
      if (replyFormSlot.hasChildNodes()) {
        replyFormSlot.replaceChildren();
        replyButton.textContent = "Reply";
        return;
      }

      replyFormSlot.appendChild(createReplyForm(thread, client, comment.id, replyButton, replyFormSlot));
      replyButton.textContent = "Cancel reply";
    });

    item.appendChild(actions);
    item.appendChild(replyFormSlot);

    return item;
  }

  function renderComments(thread, comments, client) {
    var list = getPart(thread, "[data-comments-list]");
    var count = getPart(thread, "[data-comments-count]");

    if (!list) {
      return;
    }

    list.replaceChildren();
    setText(count, commentCountText(comments.length));

    if (!comments.length) {
      var empty = document.createElement("p");
      empty.className = "comments-empty";
      empty.textContent = "No published comments yet.";
      list.appendChild(empty);
      return;
    }

    var topLevel = [];
    var repliesByParent = new Map();

    comments.forEach(function (comment) {
      if (!comment.parent_id) {
        topLevel.push(comment);
        return;
      }

      if (!repliesByParent.has(comment.parent_id)) {
        repliesByParent.set(comment.parent_id, []);
      }
      repliesByParent.get(comment.parent_id).push(comment);
    });

    if (!topLevel.length) {
      var noTopLevel = document.createElement("p");
      noTopLevel.className = "comments-empty";
      noTopLevel.textContent = "No published comments yet.";
      list.appendChild(noTopLevel);
      return;
    }

    topLevel.forEach(function (comment) {
      list.appendChild(renderTopLevelComment(thread, client, comment, repliesByParent.get(comment.id) || []));
    });
  }

  function trimmedField(form, name) {
    var field = form.elements[name];
    return field ? field.value.trim() : "";
  }

  function displayNameOrFallback(rawName) {
    return rawName.trim() || "Reader";
  }

  function validateSubmission(displayName, commentText) {
    if (displayName.length > 60) {
      return "Name must be 60 characters or fewer.";
    }

    if (commentText.length < 1) {
      return "Please enter a comment.";
    }

    if (commentText.length > 1200) {
      return "Comment must be 1,200 characters or fewer.";
    }

    return "";
  }

  function setLocalFormEnabled(form, enabled) {
    Array.from(form.elements).forEach(function (element) {
      element.disabled = !enabled;
    });
  }

  function updateReplySubmitState(form) {
    var button = form.querySelector('button[type="submit"]');
    var displayName = trimmedField(form, "display_name");
    var commentText = trimmedField(form, "body");

    if (button) {
      button.disabled = Boolean(validateSubmission(displayName, commentText));
    }
  }

  function createReplyForm(thread, client, parentId, replyButton, replyFormSlot) {
    var slug = thread.dataset.chapterSlug;
    var form = document.createElement("form");
    form.className = "comments-reply-form";

    var nameField = document.createElement("div");
    nameField.className = "form-field";
    var nameLabel = createTextElement("label", "", "Name or nickname, optional");
    var nameInput = document.createElement("input");
    nameInput.name = "display_name";
    nameInput.type = "text";
    nameInput.maxLength = 60;
    nameInput.autocomplete = "name";
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);

    var bodyField = document.createElement("div");
    bodyField.className = "form-field";
    var bodyLabel = createTextElement("label", "", "Reply");
    var bodyInput = document.createElement("textarea");
    bodyInput.name = "body";
    bodyInput.rows = 2;
    bodyInput.maxLength = 1200;
    bodyInput.required = true;
    bodyField.appendChild(bodyLabel);
    bodyField.appendChild(bodyInput);

    var safety = createTextElement("p", "comments-safety-note", "Please do not include private information.");

    var actions = document.createElement("div");
    actions.className = "comments-reply-actions";
    var submit = document.createElement("button");
    submit.className = "text-button";
    submit.type = "submit";
    submit.disabled = true;
    submit.textContent = "Submit reply for review";
    var cancel = document.createElement("button");
    cancel.className = "text-button comment-reply-cancel";
    cancel.type = "button";
    cancel.textContent = "Cancel";
    actions.appendChild(submit);
    actions.appendChild(cancel);

    var status = document.createElement("p");
    status.className = "comments-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    form.appendChild(nameField);
    form.appendChild(bodyField);
    form.appendChild(safety);
    form.appendChild(actions);
    form.appendChild(status);

    form.addEventListener("input", function () {
      status.textContent = "";
      updateReplySubmitState(form);
    });

    cancel.addEventListener("click", function () {
      replyFormSlot.replaceChildren();
      replyButton.textContent = "Reply";
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var displayName = trimmedField(form, "display_name");
      var commentText = trimmedField(form, "body");
      var validationError = validateSubmission(displayName, commentText);

      if (validationError) {
        status.textContent = validationError;
        updateReplySubmitState(form);
        return;
      }

      var payload = {
        page_slug: PAGE_SLUG,
        chapter_slug: slug,
        name: displayNameOrFallback(displayName),
        comment_text: commentText,
        status: "pending",
        parent_id: parentId,
        comment_type: "comment",
        is_featured: false
      };

      status.textContent = "Sending...";
      setLocalFormEnabled(form, false);

      withTimeout(
        client
        .from("comments")
        .insert(payload),
        12000,
        "Supabase reply submit request timed out"
      )
        .then(function (result) {
          if (result.error) {
            throw result.error;
          }

          form.reset();
          status.textContent = "Thanks - your reply was submitted for review.";
          debugEvent("Comments: submitted pending reply for " + slug);
        })
        .catch(function (error) {
          console.error("Comments: reply submit failed", {
            chapterSlug: slug,
            parentId: parentId,
            error: error,
            payload: payload
          });
          debugError("Comments: reply submit failed for " + slug, error);
          if (error && error.message) {
            status.textContent = "Sorry, the reply could not be submitted: " + error.message;
          } else {
            status.textContent = "Sorry, the reply could not be submitted. Check the browser console.";
          }
        })
        .finally(function () {
          setLocalFormEnabled(form, true);
          updateReplySubmitState(form);
        });
    });

    return form;
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

  function supabaseReadSelfTest(client) {
    withTimeout(
      client
      .from("comments")
      .select("id")
      .eq("page_slug", PAGE_SLUG)
      .eq("status", "approved")
      .limit(1),
      10000,
      "Supabase read self-test timed out"
    )
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        console.log("Comments: Supabase read self-test succeeded");
      })
      .catch(function (error) {
        console.error("Comments: Supabase read self-test failed", error);
        debugError("Comments: Supabase read self-test failed", error);
      });
  }

  function updateSubmitState(thread) {
    var form = getPart(thread, "[data-comments-form]");
    if (!form || thread.classList.contains("comments-unavailable")) {
      return;
    }

    var button = form.querySelector('button[type="submit"]');
    if (!button) {
      return;
    }

    var displayName = trimmedField(form, "display_name");
    var commentText = trimmedField(form, "body");
    button.disabled = Boolean(validateSubmission(displayName, commentText));
  }

  function prepareForm(thread, client) {
    var form = getPart(thread, "[data-comments-form]");
    var slug = thread.dataset.chapterSlug;

    if (!form) {
      return;
    }

    form.addEventListener("input", function () {
      setStatus(thread, "");
      updateSubmitState(thread);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var displayName = trimmedField(form, "display_name");
      var commentText = trimmedField(form, "body");
      var validationError = validateSubmission(displayName, commentText);

      if (validationError) {
        setStatus(thread, validationError);
        updateSubmitState(thread);
        return;
      }

      setStatus(thread, "Sending...");
      setFormEnabled(thread, false);

      var payload = {
        page_slug: PAGE_SLUG,
        chapter_slug: slug,
        name: displayNameOrFallback(displayName),
        comment_text: commentText,
        status: "pending",
        parent_id: null,
        comment_type: "comment",
        is_featured: false
      };

      withTimeout(
        client
        .from("comments")
        .insert(payload),
        12000,
        "Supabase submit request timed out"
      )
        .then(function (result) {
          if (result.error) {
            throw result.error;
          }

          form.reset();
          setStatus(thread, "Thanks - your comment was submitted for review.");
          debugEvent("Comments: submitted pending comment for " + slug);
        })
        .catch(function (error) {
          console.error("Comments: submit failed", {
            chapterSlug: slug,
            error: error,
            payload: payload
          });
          debugError("Comments: submit failed for " + slug, error);
          if (error && error.message) {
            setStatus(thread, "Sorry, the comment could not be submitted: " + error.message);
          } else {
            setStatus(thread, "Sorry, the comment could not be submitted. Check the browser console.");
          }
        })
        .finally(function () {
          setFormEnabled(thread, true);
        });
    });
  }

  function prepareToggle(thread, client) {
    var toggle = getToggle(thread);
    var panel = getPanel(thread);

    if (!toggle || !panel) {
      return;
    }

    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "Show chapter comments";

    toggle.addEventListener("click", function () {
      var shouldExpand = toggle.getAttribute("aria-expanded") !== "true";
      setExpanded(thread, shouldExpand, client);
    });
  }

  function loadComments(thread, client) {
    var slug = thread.dataset.chapterSlug;

    if (!ALLOWED_CHAPTERS.has(slug)) {
      debugError("Comments: unknown chapter slug " + slug);
      setUnavailable(thread, "Discussion is temporarily unavailable.");
      return;
    }

    debugEvent("Comments: loading approved comments for " + slug);
    thread.dataset.commentsLoading = "true";
    setText(getPart(thread, "[data-comments-service-state]"), "Loading discussion...");

    withTimeout(
      client
      .from("comments")
      .select("id, parent_id, name, comment_text, comment_type, is_featured, created_at")
      .eq("page_slug", PAGE_SLUG)
      .eq("chapter_slug", slug)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(MAX_APPROVED_COMMENTS),
      10000,
      "Supabase approved-comment request timed out"
    )
      .then(function (result) {
        if (result.error) {
          throw result.error;
        }

        renderComments(thread, result.data || [], client);
        thread.dataset.commentsLoaded = "true";
        setAvailable(thread);
      })
      .catch(function (error) {
        console.error("Comments: load failed", {
          chapterSlug: slug,
          error: error
        });
        debugError("Comments: could not load approved comments for " + slug, error);
        renderComments(thread, [], client);
        setAvailable(thread);
        setText(getPart(thread, "[data-comments-service-state]"), "Comments are reviewed before publication. Approved comments could not be loaded right now.");
      })
      .finally(function () {
        delete thread.dataset.commentsLoading;
      });
  }

  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
    threads.forEach(function (thread) {
      prepareToggle(thread, null);
    });
    setAllUnavailable(
      "Discussion is temporarily unavailable. Please try again later.",
      "missing Supabase URL or public key"
    );
    return;
  }

  if (!window.supabase || !window.supabase.createClient) {
    threads.forEach(function (thread) {
      prepareToggle(thread, null);
    });
    setAllUnavailable(
      "Discussion is temporarily unavailable. Please try again later.",
      "Supabase CDN failed to load"
    );
    return;
  }

  var client;

  try {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
    debugEvent("Comments: Supabase client initialized");
  } catch (error) {
    threads.forEach(function (thread) {
      prepareToggle(thread, null);
    });
    setAllUnavailable(
      "Discussion is temporarily unavailable. Please try again later.",
      "Supabase initialization failed"
    );
    debugError("Comments: Supabase initialization error detail", error);
    return;
  }

  supabaseReadSelfTest(client);

  threads.forEach(function (thread) {
    setAvailable(thread);
    prepareToggle(thread, client);
    prepareForm(thread, client);
  });
}());
