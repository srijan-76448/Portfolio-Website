(() => {
  "use strict";

  /* =========================================================
     1. UTILITIES AND APPLICATION STATE
     ========================================================= */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const state = {
    info: {},
    settings: {},
    profile: {},
    education: [],
    experience: [],
    achievements: [],
    projects: [],
    skills: {},
    memberships: [],
    languages: [],
    contact: {},
    jobs: [],
    selectedJob: null,
    searchId: 0,
    searching: false,
    cvReady: false,
  };

  const THEME_KEY = "portfolio-theme-v2";

  const asArray = (value) => Array.isArray(value) ? value : [];

  const str = (value) =>
    value === undefined || value === null ? "" : String(value).trim();

  function safeURL(value) {
    const raw = str(value);
    if (!raw) return "";

    try {
      const url = new URL(raw, window.location.href);

      if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
        return "";
      }

      return url.href;
    } catch {
      return "";
    }
  }

  function node(tag, className, content) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (content !== undefined) element.textContent = content;

    return element;
  }

  function announce(message) {
    const status = $("#app-status");
    if (status) status.textContent = message;
  }

  function setScoutStatus(message, level = "info") {
    const status = $("#job-scout-status");

    if (status) {
      status.hidden = false;
      status.dataset.level = level;
      status.textContent = message;
    }

    announce(message);
  }

  function setButtonBusy(busy) {
    const button = $("#generate-cv");
    if (!button) return;

    button.disabled = busy;
    button.textContent = busy
      ? "Searching job feeds…"
      : "Find Matching Jobs & Generate CV";
  }

  async function loadJSON(path, optional = false) {
    try {
      const response = await fetch(path, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`${path} returned HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (optional) {
        console.warn(`Optional file unavailable: ${path}`, error);
        return {};
      }

      throw error;
    }
  }

  /* =========================================================
     2. PROFILE DATA NORMALIZATION
     Supports modern uppercase and legacy lowercase JSON.
     ========================================================= */

  function normalizeContact(rawContact) {
    const contact = rawContact || {};
    const socials = contact.socials || {};

    const normalizedSocials = {};

    Object.entries(socials).forEach(([name, value]) => {
      if (name.toLowerCase() === "email") return;

      normalizedSocials[name] =
        typeof value === "string" ? { url: value } : (value || {});
    });

    return {
      ...contact,
      email: str(
        contact.email ||
        (typeof socials.email === "string"
          ? socials.email
          : socials.email?.url)
      ).replace(/^mailto:/i, ""),
      message: str(contact.message || contact["contact-text"]),
      socials: normalizedSocials,
    };
  }

  function normalizeData(raw) {
    const modern = Boolean(
      raw.PROFILE ||
      raw.EDUCATION ||
      raw.PROJECTS ||
      raw.SKILLS
    );

    const legacyProfile = raw["user-info"] || {};

    state.info = raw;

    state.profile = modern
      ? (raw.PROFILE || {})
      : {
          name: legacyProfile["user-name"] || "",
          title: legacyProfile["user-details"] || "",
          "about-me": legacyProfile["about-me"] || "",
          "short-description":
            legacyProfile["user-short-description"] || "",
          "profile-image": legacyProfile["profile-pic"] || "",
        };

    state.education = asArray(raw.EDUCATION);

    state.experience = asArray(raw.EXPERIENCE);

    state.achievements = asArray(raw.ACHIEVEMENTS);

    state.projects = asArray(
      modern ? raw.PROJECTS : raw.projects
    ).map((project) => ({
      ...project,
      name: str(project.name),
      description: str(project.description || project.descripton),
      technologies: asArray(project.technologies).map(str).filter(Boolean),
      url: str(project.url),
    }));

    state.skills = modern ? (raw.SKILLS || {}) : (raw.skills || {});

    state.memberships = asArray(raw.MEMBERSHIPS);
    state.languages = asArray(raw.LANGUAGES);

    state.contact = normalizeContact(
      modern ? raw.CONTACT : raw.contact
    );
  }

  function getSkillGroups() {
    return Object.entries(state.skills).map(([category, values]) => ({
      category: str(category),
      values: asArray(values).map(str).filter(Boolean),
    }));
  }

  function getSkillNames() {
    return getSkillGroups().flatMap((group) => group.values);
  }

  function getProfileEvidence() {
    const profile = state.profile;

    const parts = [
      profile.name,
      profile.title,
      profile["about-me"],
      profile["short-description"],
    ];

    state.education.forEach((item) => {
      parts.push(
        item.degree,
        item["field-of-study"],
        item.stream,
        item.college,
        item.university
      );
    });

    getSkillGroups().forEach((group) => {
      parts.push(group.category, ...group.values);
    });

    state.projects.forEach((project) => {
      parts.push(
        project.name,
        project.description,
        ...project.technologies
      );
    });

    state.experience.forEach((item) => {
      parts.push(item.position, item.company, item.description);
    });

    state.achievements.forEach((item) => {
      if (typeof item === "string") {
        parts.push(item);
      } else {
        parts.push(
          item.title,
          item.name,
          item.achievement,
          item.organization,
          item.description
        );
      }
    });

    return parts.map(str).filter(Boolean);
  }

  function getProfileText() {
    return getProfileEvidence()
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9+#.]+/g, " ");
  }

  /* =========================================================
     3. THEME, NAVIGATION AND LOADING SCREEN
     ========================================================= */

  function setupTheme() {
    let saved = "";

    try {
      saved = localStorage.getItem(THEME_KEY) || "";
    } catch {
      // Continue without local storage.
    }

    const configured = str(state.settings.THEME?.mode);
    const initial = saved || configured || "dark";

    function applyTheme(theme) {
      const value = theme === "light" ? "light" : "dark";

      document.documentElement.dataset.theme = value;

      const button = $("#theme-toggle");

      if (button) {
        button.textContent = value === "light" ? "☼" : "◐";
        button.setAttribute(
          "aria-label",
          value === "light"
            ? "Switch to dark theme"
            : "Switch to light theme"
        );
      }
    }

    applyTheme(initial);

    $("#theme-toggle")?.addEventListener("click", () => {
      const next =
        document.documentElement.dataset.theme === "dark"
          ? "light"
          : "dark";

      applyTheme(next);

      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // Theme still changes for the current page.
      }
    });
  }

  function setupNavigation() {
    const toggle = $("#nav-toggle");
    const nav = $("#site-nav");

    if (!toggle || !nav) return;

    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    $$("a", nav).forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function hideLoadingScreen() {
    const loader = $("#loadingScreen");
    if (!loader) return;

    loader.classList.add("hidden");

    window.setTimeout(() => loader.remove(), 500);
  }

  /* =========================================================
     4. PROFILE AND PORTFOLIO RENDERING
     ========================================================= */

  function buildSummary() {
    const profile = state.profile;

    const authored = str(
      profile["short-description"] ||
      profile["user-short-description"]
    );

    if (authored) return authored;

    const about = str(profile["about-me"]);
    if (about) return about;

    const title = str(profile.title) || "Engineering professional";
    const skills = getSkillNames().slice(0, 5);
    const projectNames = state.projects
      .map((project) => project.name)
      .filter(Boolean)
      .slice(0, 2);

    const sentences = [title];

    if (skills.length) {
      sentences.push(`Technical skills include ${skills.join(", ")}.`);
    }

    if (projectNames.length) {
      sentences.push(`Selected projects include ${projectNames.join(" and ")}.`);
    }

    return sentences.join(". ").replace(/\.\./g, ".");
  }

  function renderProfile() {
    const profile = state.profile;

    document.title =
      `${str(profile.name) || "Portfolio"}` +
      `${str(state.settings.BRANDING?.pageTitleSuffix) ||
        " | Robotics & Embedded Systems"}`;

    const favicon =
      state.settings.BRANDING?.logo ||
      state.settings.icon;

    if (favicon && $("#web-icon")) {
      $("#web-icon").href = safeURL(favicon) || favicon;
    }

    if ($("#user-short-description")) {
      $("#user-short-description").textContent = buildSummary();
    }

    if ($("#about-description")) {
      $("#about-description").textContent =
        str(profile["about-me"]) || "Profile details will be added soon.";
    }

    if ($("#current-focus")) {
      $("#current-focus").textContent =
        asArray(state.info.CURRENT_FOCUS).join("\n");
    }

    if ($("#working-principle")) {
      $("#working-principle").textContent =
        asArray(state.info.WORKING_PRINCIPLE).join("\n");
    }

    if ($("#footer-name")) {
      $("#footer-name").textContent = str(profile.name) || "Portfolio";
    }

    if ($("#current-year")) {
      $("#current-year").textContent = String(new Date().getFullYear());
    }
  }

  function renderEducation() {
    const host = $("#education-list");
    if (!host) return;

    host.replaceChildren();

    if (!state.education.length) {
      host.append(node("p", "muted", "No education details are configured."));
      return;
    }

    state.education.forEach((item) => {
      const card = node("article", "education-card");
      const left = document.createElement("div");
      const right = document.createElement("div");

      const heading = node(
        "h3",
        "",
        [
          item.degree,
          item["field-of-study"] || item.stream,
        ].filter(Boolean).join(" · ") || "Education"
      );

      const institution = node(
        "p",
        "",
        [item.college, item.university].filter(Boolean).join(" · ")
      );

      left.append(heading, institution);

      const duration = typeof item.duration === "string"
        ? item.duration
        : [item.duration?.start, item.duration?.end]
            .filter(Boolean)
            .join(" — ");

      right.append(node("div", "education-date", duration));

      if (str(item.cgpa)) {
        right.append(
          node("p", "education-cgpa", `CGPA: ${str(item.cgpa)}`)
        );
      }

      card.append(left, right);
      host.append(card);
    });
  }

  function renderCardList(items, selector, emptyMessage) {
    const host = $(selector);
    if (!host) return;

    host.replaceChildren();

    if (!items.length) {
      host.append(node("p", "muted", emptyMessage));
      return;
    }

    items.forEach((item) => {
      const data = typeof item === "string" ? { title: item } : item;

      const card = node("article", "education-card");
      const left = document.createElement("div");
      const right = document.createElement("div");

      const title = node(
        "h3",
        "",
        data.title ||
          data.name ||
          data.position ||
          data.achievement ||
          "Details"
      );

      left.append(title);

      const description = [
        data.company,
        data.organization,
        data.category,
        data.description,
      ].filter(Boolean).map(str).join(" · ");

      if (description) left.append(node("p", "", description));

      const duration = typeof data.duration === "string"
        ? data.duration
        : [data.duration?.start, data.duration?.end]
            .filter(Boolean)
            .join(" — ");

      right.append(
        node("div", "education-date", data.date || data.year || duration)
      );

      card.append(left, right);
      host.append(card);
    });
  }

  function renderSkills() {
    const host = $("#skills-list");
    if (!host) return;

    host.replaceChildren();

    getSkillGroups().forEach(({ category, values }) => {
      const card = node("article", "skill-card");
      const title = node("h3", "", category);
      const list = node("div", "skill-list");

      values.forEach((value) => {
        list.append(node("span", "skill-chip", value));
      });

      card.append(title, list);
      host.append(card);
    });
  }

  function renderProjects() {
    const host = $("#projects-list");
    if (!host) return;

    host.replaceChildren();

    state.projects.forEach((project, index) => {
      const button = node("button", "project-card");
      button.type = "button";
      button.setAttribute(
        "aria-label",
        `View details for ${project.name || "project"}`
      );

      const art = node("div", "project-art");
      art.append(
        node("span", "", `PROJECT / ${String(index + 1).padStart(2, "0")}`),
        node("span", "project-symbol", ["⌘", "⌁", "⌬", "⟡"][index % 4])
      );

      const body = node("div", "project-body");
      body.append(
        node("strong", "project-title", project.name || "Project"),
        node("p", "project-description", project.description)
      );

      const footer = node("div", "project-footer");
      footer.append(
        node("span", "", project.technologies.slice(0, 3).join(" / ")),
        node("span", "", "VIEW DETAILS ↗")
      );

      button.append(art, body, footer);

      button.addEventListener("click", () => openProject(project, index));

      host.append(button);
    });

    if (!state.projects.length) {
      host.append(node("p", "muted", "No projects are configured."));
    }
  }

  function openProject(project, index) {
    const dialog = $("#project-dialog");
    const host = $("#project-dialog-content");

    if (!dialog || !host) return;

    host.replaceChildren();

    host.append(
      node(
        "p",
        "dialog-project-number",
        `PROJECT / ${String(index + 1).padStart(2, "0")}`
      ),
      node("h2", "", project.name || "Project"),
      node(
        "p",
        "dialog-project-description",
        project["long-description"] ||
          project.description ||
          "No description is available."
      )
    );

    if (project.technologies.length) {
      host.append(
        node(
          "p",
          "muted",
          `TECHNOLOGIES · ${project.technologies.join(" · ")}`
        )
      );
    }

    const url = safeURL(project.url);

    if (url) {
      const link = node("a", "dialog-project-link", "Open project ↗");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      host.append(link);
    }

    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function setupProjectDialog() {
    const dialog = $("#project-dialog");
    const close = $("#project-dialog-close");

    if (!dialog || !close) return;

    function closeDialog() {
      if (dialog.open && typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }

    close.addEventListener("click", closeDialog);

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });
  }

  function renderCommunity() {
    const membershipHost = $("#memberships-list");

    if (membershipHost) {
      membershipHost.replaceChildren();

      state.memberships.forEach((item) => {
        membershipHost.append(
          node(
            "li",
            "",
            typeof item === "string"
              ? item
              : [item.name, item.organization].filter(Boolean).join(" · ")
          )
        );
      });

      if (!state.memberships.length) {
        membershipHost.append(node("li", "", "No memberships configured."));
      }
    }

    const languageHost = $("#languages-list");

    if (languageHost) {
      languageHost.replaceChildren();

      state.languages.forEach((item) => {
        languageHost.append(
          node(
            "span",
            "",
            typeof item === "string"
              ? item
              : item.name || item.language || ""
          )
        );
      });
    }
  }

  function renderContact() {
    const email = str(state.contact.email);
    const description = $("#contact-description");

    if (description && state.contact.message) {
      description.textContent = state.contact.message;
    }

    const emailHost = $("#email-address");

    if (emailHost) {
      emailHost.replaceChildren();

      if (email) {
        const link = node("a", "", email);
        link.href = `mailto:${email}`;
        emailHost.append(link);
      }
    }

    const socials = $("#social-links");

    if (socials) {
      socials.replaceChildren();

      Object.entries(state.contact.socials || {}).forEach(([name, item]) => {
        const url = safeURL(typeof item === "string" ? item : item.url);
        if (!url) return;

        const link = node(
          "a",
          "social-link",
          name === "x" ? "X" : name.charAt(0).toUpperCase() + name.slice(1)
        );

        link.href = url;

        if (!url.startsWith("mailto:") && !url.startsWith("tel:")) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }

        socials.append(link);
      });
    }

    const form = $("#contact-form");

    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();

        if (!email) {
          announce("Configure the contact email in assets/info.json.");
          return;
        }

        const name = str($("#name")?.value);
        const sender = str($("#email")?.value);
        const message = str($("#message")?.value);

        const subject = encodeURIComponent(`Portfolio enquiry from ${name}`);
        const body = encodeURIComponent(
          `Name: ${name}\nReply email: ${sender}\n\n${message}`
        );

        window.location.href =
          `mailto:${email}?subject=${subject}&body=${body}`;
      });
    }
  }

  function updateOptionalSections() {
    [
      ["experience", state.experience.length > 0],
      ["achievements", state.achievements.length > 0],
    ].forEach(([id, visible]) => {
      const section = document.getElementById(id);
      const link = $(`#site-nav a[href="#${id}"]`);

      if (section) section.hidden = !visible;
      if (link) link.hidden = !visible;
    });
  }

  /* =========================================================
     5. OPTIONAL GOOGLE SHEETS ACADEMIC SYNC
     ========================================================= */

  function parseCSV(csv) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < csv.length; i++) {
      const character = csv[i];

      if (quoted) {
        if (character === '"' && csv[i + 1] === '"') {
          value += '"';
          i++;
        } else if (character === '"') {
          quoted = false;
        } else {
          value += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === ",") {
        row.push(value);
        value = "";
      } else if (character === "\n") {
        row.push(value.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        value = "";
      } else {
        value += character;
      }
    }

    if (value.length || row.length) {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
    }

    return rows;
  }

  async function syncAcademicData() {
    const config = state.settings.ACADEMIC_DATA;
    const field = config?.fields?.BTech;

    if (
      !config?.spreadsheetId ||
      config.provider !== "googleSheetsPublishedCsv" ||
      !field?.sheet ||
      !field?.cell ||
      !state.education[0]
    ) {
      return;
    }

    const match = /^([A-Z]+)(\d+)$/i.exec(field.cell);
    if (!match) return;

    let column = 0;

    for (const character of match[1].toUpperCase()) {
      column = column * 26 + character.charCodeAt(0) - 64;
    }

    const rowIndex = Number(match[2]) - 1;
    const columnIndex = column - 1;
    const gid = field.gid ?? config.gid;

    const url = gid !== undefined
      ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(config.spreadsheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`
      : `https://docs.google.com/spreadsheets/d/${encodeURIComponent(config.spreadsheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(field.sheet)}`;

    const status = $("#academic-status");
    const cacheKey =
      `academic-cache:${config.spreadsheetId}:${field.sheet}:${field.cell}`;

    let cached = null;

    try {
      cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    } catch {
      // Ignore an invalid cache.
    }

    if (cached && Number.isFinite(Number(cached.value))) {
      state.education[0].cgpa = cached.value;
      renderEducation();
    }

    try {
      const response = await fetch(url, { cache: "no-store" });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const csv = await response.text();

      if (/<html|<!doctype/i.test(csv)) {
        throw new Error("Expected CSV but received HTML.");
      }

      const cell = parseCSV(csv)[rowIndex]?.[columnIndex];
      const value = Number(str(cell).replace(/,/g, ""));

      if (cell === undefined || !str(cell) || !Number.isFinite(value)) {
        throw new Error("Configured spreadsheet cell is not numeric.");
      }

      const configuredPrecision = Number(field.displayPrecision ?? 2);
      const precision =
        Number.isInteger(configuredPrecision) &&
        configuredPrecision >= 0 &&
        configuredPrecision <= 6
          ? configuredPrecision
          : 2;

      state.education[0].cgpa = Number(value.toFixed(precision));

      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            value: state.education[0].cgpa,
            updatedAt: Date.now(),
          })
        );
      } catch {
        // Caching is optional.
      }

      if (status) status.textContent = "Academic data synced.";
      renderEducation();
    } catch (error) {
      console.warn("Academic sync unavailable:", error.message);

      if (status) {
        status.textContent = cached
          ? "Showing the last cached academic value; live sync is unavailable."
          : "Academic sync is unavailable. Check the published sheet and cell configuration.";
      }
    }
  }

  /* =========================================================
     6. JOB FEED NORMALIZATION AND SEARCH
     ========================================================= */

  function stripHTML(value) {
    const parser = new DOMParser();
    const documentFragment = parser.parseFromString(
      String(value || ""),
      "text/html"
    );

    return (documentFragment.body.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeJob(raw, source) {
    const title = str(raw.title || raw.position);
    const company = str(raw.company_name || raw.company || raw.organization);

    return {
      id: str(raw.slug || raw.id || raw.url) ||
        `${title}|${company}|${source}`,
      title: title || "Untitled role",
      company: company || "Company not specified",
      location: str(raw.location) || (raw.remote ? "Remote" : "Not specified"),
      url: safeURL(raw.url || raw.apply_url || raw.job_url),
      description: stripHTML(
        raw.description || raw.summary || raw.content
      ),
      tags: (
        Array.isArray(raw.tags)
          ? raw.tags
          : Array.isArray(raw.skills)
            ? raw.skills
            : []
      ).map(str).filter(Boolean),
      source,
    };
  }

  async function fetchFeed(url, source, transform = (item) => item) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`${source} returned HTTP ${response.status}`);
      }

      const data = await response.json();

      const entries = Array.isArray(data)
        ? data
        : Array.isArray(data.data)
          ? data.data
          : [];

      return entries
        .filter(Boolean)
        .map(transform)
        .map((item) => normalizeJob(item, source))
        .filter((job) => job.title && job.description);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function fetchJobFeeds() {
    const failures = [];

    const feeds = await Promise.all([
      fetchFeed(
        "https://www.arbeitnow.com/api/job-board-api",
        "Arbeitnow"
      ).catch((error) => {
        failures.push(`Arbeitnow: ${error.message}`);
        return [];
      }),

      fetchFeed(
        "https://remoteok.com/api",
        "RemoteOK",
        (item) => ({
          ...item,
          title: item.position || item.title,
          company: item.company,
          location: item.location || (item.remote ? "Remote" : ""),
        })
      ).catch((error) => {
        failures.push(`RemoteOK: ${error.message}`);
        return [];
      }),
    ]);

    const unique = new Map();

    feeds.flat().forEach((job) => {
      const key = [
        job.title.toLowerCase(),
        job.company.toLowerCase(),
        job.url,
      ].join("|");

      if (!unique.has(key)) unique.set(key, job);
    });

    return {
      jobs: Array.from(unique.values()),
      failures,
    };
  }

  function rankJobs(jobs, targetRole) {
    const terms = str(targetRole)
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((term) => term.length > 1);

    if (!terms.length) return [];

    return jobs
      .map((job) => {
        const title = job.title.toLowerCase();

        const content = [
          job.title,
          job.company,
          job.location,
          job.description,
          job.tags.join(" "),
        ].join(" ").toLowerCase();

        const titleMatches = terms.filter((term) => title.includes(term)).length;
        const contentMatches = terms.filter((term) => content.includes(term)).length;

        return {
          ...job,
          searchScore: titleMatches * 4 + contentMatches,
        };
      })
      .filter((job) => job.searchScore > 0)
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, 20);
  }

  /* =========================================================
     7. MANDATORY REQUIREMENT SCREENING
     Unknown evidence is never treated as a pass.
     ========================================================= */

  const STOPWORDS = new Set([
    "the", "and", "with", "for", "from", "that", "this", "will",
    "are", "you", "your", "our", "have", "has", "into", "using",
    "use", "ability", "strong", "good", "excellent", "work", "working",
    "knowledge", "experience", "skills", "skill", "years", "year",
    "including", "required", "requirements", "preferred", "plus", "must",
    "should", "able", "such", "other", "role", "team", "teams",
    "responsibilities", "qualification", "qualifications", "who", "what",
    "their", "they", "minimum", "candidate", "candidates", "applicant",
    "applicants", "proven", "demonstrated", "familiarity", "understanding",
    "proficiency", "proficient", "related", "field", "degree", "bachelor",
    "bachelors", "master", "masters", "or", "an", "in", "to", "of", "be",
    "as", "at", "on", "by", "is", "it", "can", "etc", "within", "across",
    "responsible", "including", "various", "must-have",
  ]);

  function splitDescription(description) {
    return description
      .replace(/([.!?])\s+/g, "$1\n")
      .split(/\n|[•●▪◦]/)
      .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
      .filter((line) => line.length >= 15 && line.length <= 450);
  }

  function findMandatoryRequirements(description) {
    const mandatoryPattern =
      /\b(required|required to|required qualification|must have|must be|must possess|mandatory|essential|minimum qualification|minimum of|at least \d+ years|need to have|you will need|eligible candidates must)\b/i;

    const unique = new Set();

    return splitDescription(description).filter((line) => {
      if (!mandatoryPattern.test(line)) return false;

      const key = line.toLowerCase();

      if (unique.has(key)) return false;

      unique.add(key);
      return true;
    });
  }

  function tokenizeRequirement(requirement) {
    return Array.from(new Set(
      requirement
        .toLowerCase()
        .replace(/[^a-z0-9+#.]+/g, " ")
        .split(/\s+/)
        .filter((word) =>
          word.length > 2 &&
          !STOPWORDS.has(word) &&
          !/^\d+$/.test(word)
        )
    ));
  }

  function checkJobMatch(job) {
    if (!job.description || job.description.length < 80) {
      return {
        status: "unknown",
        title: "Insufficient job details",
        reasons: [
          "The listing does not provide enough detail to assess its mandatory requirements.",
          "The CV cannot be generated automatically from this listing.",
        ],
      };
    }

    const requirements = findMandatoryRequirements(job.description);

    if (!requirements.length) {
      return {
        status: "unknown",
        title: "Mandatory requirements are unclear",
        reasons: [
          "The system could not confidently identify mandatory requirements in this listing.",
          "This does not mean you are unqualified. It means the system cannot safely verify the match.",
        ],
      };
    }

    const evidence = getProfileText();

    const results = requirements.map((requirement) => {
      const tokens = tokenizeRequirement(requirement);

      if (!tokens.length) {
        return {
          requirement,
          passed: false,
          missing: [],
        };
      }

      const missing = tokens.filter((token) => !evidence.includes(token));

      return {
        requirement,
        passed: missing.length === 0,
        missing,
      };
    });

    const failed = results.filter((item) => !item.passed);

    if (failed.length) {
      return {
        status: "unknown",
        title: "Mandatory requirements are not fully evidenced",
        reasons: failed.slice(0, 8).map((item) => {
          if (!item.missing.length) {
            return `The system could not verify: ${item.requirement}`;
          }

          return (
            `Profile evidence is missing for: ${item.missing.join(", ")}. ` +
            `Requirement: ${item.requirement}`
          );
        }),
      };
    }

    return {
      status: "pass",
      title: "Detected mandatory requirement terms are represented",
      reasons: [
        `Checked ${requirements.length} mandatory requirement statement(s).`,
        "This is a keyword screen, not a guarantee of eligibility. Review the listing and generated CV carefully.",
      ],
    };
  }

  /* =========================================================
     8. CV GENERATION
     ========================================================= */

  function rankProjects(role) {
    const terms = str(role)
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((term) => term.length > 1);

    return state.projects
      .map((project, index) => {
        const content = [
          project.name,
          project.description,
          ...project.technologies,
        ].join(" ").toLowerCase();

        const score = terms.filter((term) => content.includes(term)).length;

        return { project, index, score };
      })
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((item) => item.project);
  }

  function sectionHTML(title, content) {
    if (!content) return "";

    return `
      <section class="cv-section">
        <h3>${title}</h3>
        ${content}
      </section>
    `;
  }

  function renderCV(job) {
    const preview = $("#cv-preview");

    if (!preview || !job) return;

    const name = str(state.profile.name) || "Candidate";
    const role = job.title;
    const email = str(state.contact.email);

    const contactParts = [];

    if (email) {
      contactParts.push(
        `<a href="mailto:${encodeURIComponent(email)}">${escapeHTML(email)}</a>`
      );
    }

    Object.entries(state.contact.socials || {}).forEach(([label, item]) => {
      const url = safeURL(typeof item === "string" ? item : item.url);
      if (!url) return;

      contactParts.push(
        `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a>`
      );
    });

    const educationHTML = state.education.map((item) => {
      const duration = typeof item.duration === "string"
        ? item.duration
        : [item.duration?.start, item.duration?.end].filter(Boolean).join(" — ");

      const details = [
        item.college,
        item.university,
        duration,
        item.cgpa ? `CGPA: ${item.cgpa}` : "",
      ].filter(Boolean).map(escapeHTML).join(" · ");

      return `
        <article class="cv-entry">
          <h4>${escapeHTML([
            item.degree,
            item["field-of-study"] || item.stream,
          ].filter(Boolean).join(" · ") || "Education")}</h4>
          <p class="cv-muted">${details}</p>
        </article>
      `;
    }).join("");

    const skillsHTML = getSkillGroups().map((group) => `
      <div class="cv-skill-group">
        <h4>${escapeHTML(group.category)}</h4>
        <p>${group.values.map(escapeHTML).join(" · ")}</p>
      </div>
    `).join("");

    const projectHTML = rankProjects(role).map((project) => `
      <article class="cv-entry">
        <h4>${escapeHTML(project.name || "Project")}</h4>
        ${project.description
          ? `<p>${escapeHTML(project.description)}</p>`
          : ""}
        ${project.technologies.length
          ? `<p class="cv-muted">${project.technologies.map(escapeHTML).join(" · ")}</p>`
          : ""}
      </article>
    `).join("");

    const experienceHTML = state.experience.map((item) => {
      const duration = typeof item.duration === "string"
        ? item.duration
        : [item.duration?.start, item.duration?.end].filter(Boolean).join(" — ");

      return `
        <article class="cv-entry">
          <h4>${escapeHTML([
            item.position,
            item.company,
          ].filter(Boolean).join(" · ") || "Experience")}</h4>
          <p class="cv-muted">${escapeHTML(duration)}</p>
          ${item.description
            ? `<p>${escapeHTML(item.description)}</p>`
            : ""}
        </article>
      `;
    }).join("");

    const achievementsHTML = state.achievements.map((item) => {
      const data = typeof item === "string" ? { title: item } : item;

      return `
        <article class="cv-entry">
          <h4>${escapeHTML(
            data.title || data.name || data.achievement || "Achievement"
          )}</h4>
          <p>${escapeHTML([
            data.organization,
            data.date || data.year,
            data.description,
          ].filter(Boolean).join(" · "))}</p>
        </article>
      `;
    }).join("");

    preview.innerHTML = `
      <article class="cv-sheet">
        <header class="cv-header">
          <h2>${escapeHTML(name)}</h2>
          <p class="cv-target-role">${escapeHTML(role)}</p>
          <p class="cv-contact-line">${contactParts.join(" · ")}</p>
        </header>

        <div class="cv-columns">
          <aside class="cv-column cv-left-column">
            ${sectionHTML("Technical Skills", skillsHTML)}
            ${sectionHTML("Education", educationHTML)}
          </aside>

          <div class="cv-column cv-right-column">
            ${sectionHTML(
              "Professional Summary",
              `<p>${escapeHTML(buildSummary())}</p>`
            )}
            ${sectionHTML("Projects", projectHTML)}
            ${sectionHTML("Experience", experienceHTML)}
            ${sectionHTML("Achievements", achievementsHTML)}
          </div>
        </div>

        <footer class="cv-footer">
          Prepared using the profile information provided. Verify all details
          before submitting.
        </footer>
      </article>
    `;

    preview.hidden = false;

    const printButton = $("#print-cv");
    const closeButton = $("#close-cv");

    if (printButton) printButton.disabled = false;
    if (closeButton) closeButton.hidden = false;

    state.cvReady = true;
    state.selectedJob = job;

    preview.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showMatchResult(host, result) {
    host.replaceChildren();

    host.append(node("strong", "", result.title));

    const list = document.createElement("ul");

    result.reasons.forEach((reason) => {
      list.append(node("li", "", reason));
    });

    host.append(list);
  }

  /* =========================================================
     9. JOB RESULT CARDS AND GATED GENERATION
     ========================================================= */

  function renderJobCards(jobs) {
    const host = $("#job-scout-results");
    if (!host) return;

    host.replaceChildren();

    if (!jobs.length) {
      host.append(
        node(
          "p",
          "muted",
          "No matching jobs were found. Try a broader target role or retry later."
        )
      );
      return;
    }

    jobs.forEach((job) => {
      const card = node("article", "job-card");

      const title = node("h3", "", job.title);

      const company = node(
        "p",
        "job-meta",
        `${job.company} · ${job.location} · ${job.source}`
      );

      const excerpt = node(
        "p",
        "job-excerpt",
        job.description.length > 320
          ? `${job.description.slice(0, 320)}…`
          : job.description
      );

      const actions = node("div", "job-actions");

      const matchButton = node(
        "button",
        "button",
        "Check match & generate CV"
      );

      matchButton.type = "button";

      const resultHost = node("div", "job-match-result");
      resultHost.hidden = true;

      matchButton.addEventListener("click", () => {
        const result = checkJobMatch(job);

        resultHost.hidden = false;
        resultHost.dataset.result = result.status;

        showMatchResult(resultHost, result);

        if (result.status === "pass") {
          const roleInput = $("#cv-role");
          if (roleInput) roleInput.value = job.title;

          renderCV(job);

          const assessment = $("#cv-assessment");

          if (assessment) {
            assessment.hidden = false;
            assessment.dataset.level = "good";

            showMatchResult(assessment, {
              title: "Profile check passed — CV generated",
              reasons: [
                ...result.reasons,
                `Selected listing: ${job.title} at ${job.company}.`,
              ],
            });
          }

          setScoutStatus(
            `The profile check passed for ${job.title}. Review the generated CV before applying.`,
            "success"
          );
        } else {
          // A failed/unknown listing must not leave a previous CV available.
          state.cvReady = false;
          state.selectedJob = null;

          const preview = $("#cv-preview");
          const printButton = $("#print-cv");
          const closeButton = $("#close-cv");

          if (preview) preview.hidden = true;
          if (printButton) printButton.disabled = true;
          if (closeButton) closeButton.hidden = true;

          const assessment = $("#cv-assessment");

          if (assessment) {
            assessment.hidden = false;
            assessment.dataset.level = "poor";

            showMatchResult(assessment, {
              title: "CV generation blocked",
              reasons: result.reasons,
            });
          }

          setScoutStatus(
            "This listing did not pass the automatic profile check. No CV was generated.",
            "warning"
          );
        }
      });

      actions.append(matchButton);

      if (job.url) {
        const link = node("a", "button button-quiet", "View listing ↗");
        link.href = job.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        actions.append(link);
      }

      card.append(title, company, excerpt, actions, resultHost);
      host.append(card);
    });
  }

  function setupJobScout() {
    const button = $("#generate-cv");
    const roleInput = $("#cv-role");

    if (!button || !roleInput) {
      console.error("Job Scout controls are missing from index.html.");
      return;
    }

    button.addEventListener("click", async () => {
      const role = str(roleInput.value);

      if (!role) {
        setScoutStatus(
          "Enter your target job title before searching.",
          "warning"
        );
        roleInput.focus();
        return;
      }

      if (state.searching) return;

      const thisSearch = ++state.searchId;

      state.searching = true;
      state.cvReady = false;
      state.selectedJob = null;

      const preview = $("#cv-preview");
      const printButton = $("#print-cv");
      const closeButton = $("#close-cv");
      const results = $("#job-scout-results");
      const assessment = $("#cv-assessment");

      if (preview) preview.hidden = true;
      if (printButton) printButton.disabled = true;
      if (closeButton) closeButton.hidden = true;
      if (results) results.replaceChildren();

      if (assessment) {
        assessment.hidden = true;
        assessment.replaceChildren();
      }

      setButtonBusy(true);
      setScoutStatus("Searching supported public job feeds…", "info");

      try {
        const { jobs, failures } = await fetchJobFeeds();

        if (thisSearch !== state.searchId) return;

        const ranked = rankJobs(jobs, role);
        state.jobs = ranked;

        if (!ranked.length) {
          renderJobCards([]);

          const explanation = failures.length
            ? ` Feed access issues: ${failures.join("; ")}.`
            : "";

          setScoutStatus(
            `No matching jobs were returned for "${role}".${explanation} Try again later or use a broader role title.`,
            "warning"
          );

          return;
        }

        renderJobCards(ranked);

        const warning = failures.length
          ? ` Some feeds were unavailable: ${failures.join("; ")}.`
          : "";

        setScoutStatus(
          `Found ${ranked.length} relevant listing(s). Select a listing to check its requirements. CV generation remains blocked until the profile check passes.${warning}`,
          "success"
        );
      } catch (error) {
        console.error("Job search failed:", error);

        if (thisSearch === state.searchId) {
          setScoutStatus(
            "Job search failed. Check your internet connection and try again. Public feeds may restrict browser requests.",
            "error"
          );
        }
      } finally {
        if (thisSearch === state.searchId) {
          state.searching = false;
          setButtonBusy(false);
        }
      }
    });

    roleInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        button.click();
      }
    });

    $("#print-cv")?.addEventListener("click", () => {
      if (!state.cvReady || !state.selectedJob) {
        setScoutStatus(
          "A CV can only be printed after a job passes the profile check.",
          "warning"
        );
        return;
      }

      window.print();
    });

    $("#close-cv")?.addEventListener("click", () => {
      const preview = $("#cv-preview");

      if (preview) preview.hidden = true;

      const closeButton = $("#close-cv");
      if (closeButton) closeButton.hidden = true;

      state.cvReady = false;
    });
  }

  /* =========================================================
     10. OPTIONAL PARTICLE BACKGROUND
     ========================================================= */

  function setupParticles() {
    const canvas = $("#particleAccelerator");

    if (
      !canvas ||
      state.settings.ANIMATIONS?.enabled === false ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let particles = [];

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);

      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const configured = Number(state.settings.PARTICLES?.count);
      const count = Number.isFinite(configured)
        ? Math.min(60, Math.max(0, configured))
        : 35;

      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      }));
    }

    function draw() {
      context.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        context.fillStyle = "rgba(54,214,208,.65)";
        context.fillRect(p.x, p.y, 2, 2);

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const distance = Math.hypot(p.x - q.x, p.y - q.y);

          if (distance < 105) {
            context.strokeStyle =
              `rgba(54,214,208,${(1 - distance / 105) * 0.12})`;

            context.beginPath();
            context.moveTo(p.x, p.y);
            context.lineTo(q.x, q.y);
            context.stroke();
          }
        }
      }

      frame = window.requestAnimationFrame(draw);
    }

    function stop() {
      window.cancelAnimationFrame(frame);
    }

    function start() {
      stop();
      draw();
    }

    resize();
    start();

    window.addEventListener("resize", resize, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });
  }

  /* =========================================================
     11. APPLICATION INITIALIZATION
     ========================================================= */

  async function main() {
    setupNavigation();
    setupProjectDialog();

    try {
      const [rawInfo, rawSettings] = await Promise.all([
        loadJSON("assets/info.json"),
        loadJSON("assets/settings.json", true),
      ]);

      state.settings = rawSettings || {};
      normalizeData(rawInfo || {});

      setupTheme();

      renderProfile();
      renderEducation();

      renderCardList(
        state.experience,
        "#experience-list",
        "No professional experience has been added yet."
      );

      renderCardList(
        state.achievements,
        "#achievements-list",
        "No achievements have been added yet."
      );

      renderSkills();
      renderProjects();
      renderCommunity();
      renderContact();
      updateOptionalSections();

      setupJobScout();
      setupParticles();

      // Academic sync is optional and must never stop the portfolio.
      syncAcademicData().catch((error) => {
        console.warn("Academic data sync failed:", error);
      });
    } catch (error) {
      console.error("Portfolio initialization failed:", error);

      if ($("#user-short-description")) {
        $("#user-short-description").textContent =
          "Portfolio data could not be loaded. Check assets/info.json and assets/settings.json.";
      }

      announce("Portfolio initialization failed. Check the browser console.");
    } finally {
      hideLoadingScreen();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main, { once: true });
  } else {
    main();
  }
})();