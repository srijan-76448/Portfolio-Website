(() => {
  "use strict";

  // ============================================================
  // 1. UTILITIES AND APPLICATION STATE
  // ============================================================

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];

  const escapeHTML = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  const safeUrl = (value) => {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const url = new URL(value.trim());
      return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol)
        ? url.href
        : "";
    } catch {
      return "";
    }
  };

  const STORAGE_THEME = "portfolio-theme-v2";
  const MATCH_THRESHOLD = 75;
  const SKILL_MATCH_THRESHOLD = 75;

  const STOPWORDS = new Set([
    "and",
    "the",
    "with",
    "for",
    "from",
    "that",
    "this",
    "will",
    "are",
    "you",
    "your",
    "our",
    "have",
    "has",
    "into",
    "using",
    "use",
    "ability",
    "strong",
    "good",
    "excellent",
    "work",
    "working",
    "knowledge",
    "experience",
    "skills",
    "skill",
    "years",
    "year",
    "including",
    "required",
    "requirements",
    "preferred",
    "plus",
    "must",
    "should",
    "able",
    "such",
    "other",
    "role",
    "team",
    "teams",
    "responsibilities",
    "qualification",
    "qualifications",
    "who",
    "what",
    "their",
    "they",
    "minimum",
    "candidate",
    "candidates",
    "applicant",
    "applicants",
    "proven",
    "demonstrated",
    "familiarity",
    "understanding",
    "proficiency",
    "related",
    "field",
    "degree",
    "bachelor",
    "bachelors",
    "master",
    "masters",
    "or",
    "an",
    "a",
    "in",
    "to",
    "of",
    "be",
    "as",
    "at",
    "on",
    "by",
    "is",
    "it",
    "can",
    "etc",
    "job",
    "company",
    "based",
    "across",
    "within",
    "engineer",
    "engineering",
    "developer",
    "development",
    "system",
    "systems",
    "work",
    "position",
    "responsible",
    "including",
  ]);

  let info = null;
  let settings = null;
  let currentProfile = {};
  let projects = [];
  let education = [];
  let experience = [];
  let achievements = [];
  let skills = {};
  let memberships = [];
  let languages = [];
  let contact = {};
  let extractedRequirements = [];
  let reviewedDescription = "";

  function announce(message) {
    const status = $("#app-status");
    if (status) status.textContent = message;
  }

  async function fetchJSON(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Unable to load ${path} (${response.status})`);
    }
    return response.json();
  }

  function normalizeData(rawInfo, rawSettings) {
    const v2 = Boolean(
      rawInfo.PROFILE || rawInfo.EDUCATION || rawInfo.PROJECTS,
    );
    const oldUser = rawInfo["user-info"] || {};

    const profile = v2
      ? rawInfo.PROFILE || {}
      : {
          name: oldUser["user-name"],
          title: oldUser["user-details"],
          "about-me": oldUser["about-me"],
          "short-description": oldUser["user-short-description"],
          "profile-image": oldUser["profile-pic"],
        };

    projects = (v2 ? rawInfo.PROJECTS || [] : rawInfo.projects || []).map(
      (p) => ({
        ...p,
        url: typeof p.url === "string" ? p.url.trim() : "",
        description: p.description || p.descripton || "",
        technologies: Array.isArray(p.technologies) ? p.technologies : [],
      }),
    );

    education = v2 && Array.isArray(rawInfo.EDUCATION) ? rawInfo.EDUCATION : [];
    experience =
      v2 && Array.isArray(rawInfo.EXPERIENCE) ? rawInfo.EXPERIENCE : [];
    achievements =
      v2 && Array.isArray(rawInfo.ACHIEVEMENTS) ? rawInfo.ACHIEVEMENTS : [];
    skills = v2 ? rawInfo.SKILLS || {} : rawInfo.skills || {};
    memberships =
      v2 && Array.isArray(rawInfo.MEMBERSHIPS) ? rawInfo.MEMBERSHIPS : [];
    languages = v2 && Array.isArray(rawInfo.LANGUAGES) ? rawInfo.LANGUAGES : [];
    contact = v2 ? rawInfo.CONTACT || {} : rawInfo.contact || {};

    if (!v2 && contact.socials) {
      contact = {
        ...contact,
        email: contact.socials.email?.url,
        socials: Object.fromEntries(
          Object.entries(contact.socials)
            .filter(([key]) => key !== "email")
            .map(([key, value]) => [
              key,
              {
                url: typeof value === "string" ? value : value?.url,
                icon: key,
                "user-id": value?.["user-id"] || value?.userId || "",
              },
            ]),
        ),
        message: contact["contact-text"] || "",
      };
    }

    return { profile, rawInfo, rawSettings };
  }

  // ============================================================
  // 2. THEME, NAVIGATION, AND PROFILE RENDERING
  // ============================================================

  function applyTheme() {
    let saved = null;
    try {
      saved = localStorage.getItem(STORAGE_THEME);
    } catch {}

    const theme = saved || settings?.THEME?.mode || "dark";
    document.documentElement.dataset.theme =
      theme === "light" ? "light" : "dark";

    const button = $("#theme-toggle");
    if (button) {
      button.setAttribute(
        "aria-label",
        theme === "light" ? "Switch to dark theme" : "Switch to light theme",
      );
      button.textContent = theme === "light" ? "☼" : "◐";
    }
  }

  function setupTheme() {
    applyTheme();

    $("#theme-toggle")?.addEventListener("click", () => {
      const next =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(STORAGE_THEME, next);
      } catch {}
      applyTheme();
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

    $$("#site-nav a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function hideLoadingScreen() {
    const screen = $("#loadingScreen");
    if (!screen) return;
    screen.classList.add("hidden");
    window.setTimeout(() => screen.remove(), 550);
  }

  function buildShortDescription(profile) {
    const name = String(profile.name || "").trim();
    const title = String(profile.title || "engineering professional").trim();

    const skillNames = Object.values(skills)
      .flat()
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);

    const projectNames = projects
      .map((p) => String(p.name || "").trim())
      .filter(Boolean)
      .slice(0, 2);

    const field = education
      .map((item) =>
        [item.degree, item["field-of-study"] || item.stream]
          .filter(Boolean)
          .join(" in "),
      )
      .filter(Boolean)[0];

    const parts = [
      name
        ? `${name} is a ${title.toLowerCase()} interested in building practical, reliable systems.`
        : `A ${title.toLowerCase()} interested in building practical, reliable systems.`,
    ];

    if (field) parts.push(`Academic background: ${field}.`);
    if (skillNames.length)
      parts.push(`Technical toolkit includes ${skillNames.join(", ")}.`);
    if (projectNames.length)
      parts.push(`Selected projects include ${projectNames.join(" and ")}.`);
    parts.push(
      "Prefers open, maintainable engineering and hands-on problem solving.",
    );

    const result = parts.join(" ").replace(/\s+/g, " ").trim();
    const words = result.split(/\s+/);

    return words.length > 60
      ? `${words
          .slice(0, 60)
          .join(" ")
          .replace(/[,:;—-]+$/, "")}.`
      : result;
  }

  function renderProfile(profile) {
    document.title =
      `${profile.name || "Portfolio"}` +
      `${settings?.BRANDING?.pageTitleSuffix || " | Robotics & Embedded Systems"}`;

    const icon = settings?.BRANDING?.logo || settings?.icon;
    if (icon && $("#web-icon")) $("#web-icon").href = icon;

    const authoredShort = String(
      profile["short-description"] || profile["user-short-description"] || "",
    ).trim();

    const about = String(profile["about-me"] || "").trim();

    if ($("#user-short-description")) {
      $("#user-short-description").textContent =
        authoredShort && authoredShort.toLowerCase() !== about.toLowerCase()
          ? authoredShort
          : buildShortDescription(profile);
    }

    if ($("#about-description")) {
      $("#about-description").textContent =
        about || "Profile details will be available soon.";
    }

    if ($("#current-focus")) {
      $("#current-focus").textContent = Array.isArray(info?.CURRENT_FOCUS)
        ? info.CURRENT_FOCUS.join("\n")
        : "";
    }

    if ($("#working-principle")) {
      $("#working-principle").textContent = Array.isArray(
        info?.WORKING_PRINCIPLE,
      )
        ? info.WORKING_PRINCIPLE.join("\n")
        : "";
    }

    if ($("#footer-name"))
      $("#footer-name").textContent = profile.name || "Portfolio";
    if ($("#current-year"))
      $("#current-year").textContent = new Date().getFullYear();
  }

  function renderEducation() {
    const host = $("#education-list");
    if (!host) return;
    host.replaceChildren();

    if (!education.length) {
      host.innerHTML =
        '<p class="muted">Education details are not configured in info.json yet.</p>';
      return;
    }

    education.forEach((item) => {
      const duration = item.duration;
      const date =
        typeof duration === "string"
          ? duration
          : [duration?.start, duration?.end].filter(Boolean).join(" — ");

      const card = document.createElement("article");
      card.className = "education-card";

      const left = document.createElement("div");
      const right = document.createElement("div");
      const degree = document.createElement("h3");

      degree.textContent =
        [item.degree, item["field-of-study"] || item.stream]
          .filter(Boolean)
          .join(" · ") || "Education";

      const school = document.createElement("p");
      school.textContent = [item.college, item.university]
        .filter(Boolean)
        .join(" · ");

      const dates = document.createElement("div");
      dates.className = "education-date";
      dates.textContent = date || "";

      left.append(degree, school);
      right.append(dates);

      const cgpaText = String(item.cgpa ?? "").trim();
      const cgpaValue = Number.parseFloat(cgpaText);

      if (cgpaText && Number.isFinite(cgpaValue) && cgpaValue > 6.5) {
        const score = document.createElement("p");
        score.className = "education-cgpa";
        score.textContent = `CGPA: ${cgpaValue}`;
        right.append(score);
      }

      card.append(left, right);
      host.append(card);
    });
  }

  function renderExperience() {
    const host = $("#experience-list");
    if (!host) return;
    host.replaceChildren();

    experience.forEach((item) => {
      const card = document.createElement("article");
      card.className = "education-card";

      const left = document.createElement("div");
      const right = document.createElement("div");
      const title = document.createElement("h3");

      title.textContent =
        [item.position, item.company].filter(Boolean).join(" · ") ||
        "Experience";
      left.append(title);

      if (item.description) {
        const description = document.createElement("p");
        description.textContent = item.description;
        left.append(description);
      }

      const duration = item.duration;
      const dates = document.createElement("div");
      dates.className = "education-date";
      dates.textContent =
        typeof duration === "string"
          ? duration
          : [
              duration?.start,
              duration?.end || (duration?.start ? "Present" : ""),
            ]
              .filter(Boolean)
              .join(" — ");

      right.append(dates);
      card.append(left, right);
      host.append(card);
    });

    if (!experience.length) {
      host.innerHTML =
        '<p class="muted">No professional experience has been added yet.</p>';
    }
  }

  function renderAchievements() {
    const host = $("#achievements-list");
    if (!host) return;
    host.replaceChildren();

    achievements.forEach((item) => {
      const entry = typeof item === "string" ? { title: item } : item;
      const card = document.createElement("article");
      card.className = "education-card";

      const left = document.createElement("div");
      const right = document.createElement("div");
      const title = document.createElement("h3");

      title.textContent =
        entry.title || entry.name || entry.achievement || "Achievement";
      left.append(title);

      const details = [entry.organization, entry.category]
        .filter(Boolean)
        .join(" · ");
      if (details) {
        const meta = document.createElement("p");
        meta.textContent = details;
        left.append(meta);
      }

      if (entry.description) {
        const description = document.createElement("p");
        description.textContent = entry.description;
        left.append(description);
      }

      const date = document.createElement("div");
      date.className = "education-date";
      date.textContent = entry.date || entry.year || "";

      right.append(date);
      card.append(left, right);
      host.append(card);
    });

    if (!achievements.length) {
      host.innerHTML =
        '<p class="muted">No achievements have been added yet.</p>';
    }
  }

  function updateOptionalSections() {
    [
      { id: "experience", hasItems: experience.length > 0 },
      { id: "achievements", hasItems: achievements.length > 0 },
    ].forEach(({ id, hasItems }) => {
      const section = document.getElementById(id);
      const link = document.querySelector(`#site-nav a[href="#${id}"]`);
      if (section) section.hidden = !hasItems;
      if (link) link.hidden = !hasItems;
    });
  }

  function renderSkills() {
    const host = $("#skills-list");
    if (!host) return;
    host.replaceChildren();

    Object.entries(skills).forEach(([category, items]) => {
      const card = document.createElement("article");
      card.className = "skill-card";

      const title = document.createElement("h3");
      title.textContent = category;

      const list = document.createElement("div");
      list.className = "skill-list";

      (Array.isArray(items) ? items : []).forEach((item) => {
        const chip = document.createElement("span");
        chip.className = "skill-chip";
        chip.textContent = item;
        list.append(chip);
      });

      card.append(title, list);
      host.append(card);
    });
  }

  function openProject(project, index) {
    const dialog = $("#project-dialog");
    const host = $("#project-dialog-content");
    if (!dialog || !host) return;

    host.replaceChildren();

    const label = document.createElement("p");
    label.className = "dialog-project-number";
    label.textContent = `PROJECT / ${String(index + 1).padStart(2, "0")}`;

    const title = document.createElement("h2");
    title.textContent = project.name || "Project";

    const description = document.createElement("p");
    description.className = "dialog-project-description";
    description.textContent =
      project["long-description"] ||
      project.description ||
      "No description available.";

    host.append(label, title, description);

    if (project.technologies?.length) {
      const tech = document.createElement("p");
      tech.className = "muted";
      tech.textContent = `TECHNOLOGIES · ${project.technologies.join(" · ")}`;
      host.append(tech);
    }

    const url = safeUrl(project.url);
    if (url) {
      const link = document.createElement("a");
      link.className = "dialog-project-link";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open project ↗";
      host.append(link);
    }

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function renderProjects() {
    const host = $("#projects-list");
    if (!host) return;
    host.replaceChildren();

    projects.forEach((project, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "project-card";
      button.setAttribute(
        "aria-label",
        `View details for ${project.name || "project"}`,
      );

      const art = document.createElement("div");
      art.className = "project-art";

      const number = document.createElement("span");
      number.textContent = `PROJECT / ${String(index + 1).padStart(2, "0")}`;

      const symbol = document.createElement("span");
      symbol.className = "project-symbol";
      symbol.textContent = ["⌘", "⌁", "⌬", "⟡"][index % 4];

      art.append(number, symbol);

      const body = document.createElement("div");
      body.className = "project-body";

      const title = document.createElement("strong");
      title.className = "project-title";
      title.textContent = project.name || "Untitled project";

      const description = document.createElement("p");
      description.className = "project-description";
      description.textContent = project.description || "";

      body.append(title, description);

      const footer = document.createElement("div");
      footer.className = "project-footer";

      const kind = document.createElement("span");
      kind.textContent =
        project.technologies.slice(0, 3).join(" / ") || "ENGINEERING";

      const more = document.createElement("span");
      more.textContent = "VIEW DETAILS ↗";

      footer.append(kind, more);
      button.append(art, body, footer);
      button.addEventListener("click", () => openProject(project, index));
      host.append(button);
    });

    if (!projects.length) {
      host.innerHTML =
        '<p class="muted">Projects will appear here when added to info.json.</p>';
    }
  }

  function renderCommunity() {
    const host = $("#memberships-list");

    if (host) {
      host.replaceChildren();

      memberships.forEach((item) => {
        const li = document.createElement("li");
        li.textContent =
          typeof item === "string"
            ? item
            : [item.name, item.organization].filter(Boolean).join(" · ");
        host.append(li);
      });

      if (!memberships.length) {
        host.innerHTML =
          "<li>Add community memberships in info.json to show them here.</li>";
      }
    }

    const languageHost = $("#languages-list");
    if (languageHost) {
      languageHost.replaceChildren();

      languages.forEach((item) => {
        const span = document.createElement("span");
        span.textContent = item;
        languageHost.append(span);
      });

      if (!languages.length) {
        languageHost.innerHTML = "<span>Languages not configured</span>";
      }
    }
  }

  function normalizeEmail(value) {
    return String(value || "")
      .trim()
      .replace(/^mailto:/i, "")
      .split(/[?;]/, 1)[0];
  }

  function renderContact() {
    const email = normalizeEmail(
      contact.email || contact.socials?.email?.url || "",
    );

    const description = $("#contact-description");
    if (description) {
      description.textContent =
        contact.message ||
        contact["contact-text"] ||
        "Reach out for engineering conversations, open-source collaboration, and robotics projects.";
    }

    const emailHost = $("#email-address");
    if (emailHost) {
      emailHost.replaceChildren();

      if (email) {
        const link = document.createElement("a");
        link.href = `mailto:${email}`;
        link.textContent = email;
        link.className = "email-address";
        emailHost.append(link);
      }
    }

    const socialHost = $("#social-links");
    if (socialHost) {
      socialHost.replaceChildren();

      Object.entries(contact.socials || {}).forEach(([name, item]) => {
        const url = safeUrl(typeof item === "string" ? item : item?.url);
        if (!url) return;

        const link = document.createElement("a");
        link.className = "social-link";
        link.href = url;

        if (!url.startsWith("mailto:") && !url.startsWith("tel:")) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }

        link.textContent =
          name === "x" ? "X" : name.charAt(0).toUpperCase() + name.slice(1);

        socialHost.append(link);
      });
    }

    const form = $("#contact-form");
    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();

        if (!email) {
          announce("Contact email is not configured in assets/info.json.");
          return;
        }

        const name = $("#name")?.value.trim() || "";
        const sender = $("#email")?.value.trim() || "";
        const message = $("#message")?.value.trim() || "";

        const subject = encodeURIComponent(`Portfolio enquiry from ${name}`);
        const body = encodeURIComponent(
          `Name: ${name}\nReply email: ${sender}\n\n${message}`,
        );

        announce("Opening your email application…");
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
      });
    }
  }

  // ============================================================
  // 3. ACADEMIC DATA SYNC
  // ============================================================

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];

      if (quoted) {
        if (c === '"' && text[i + 1] === '"') {
          value += '"';
          i++;
        } else if (c === '"') {
          quoted = false;
        } else {
          value += c;
        }
      } else if (c === '"') {
        quoted = true;
      } else if (c === ",") {
        row.push(value);
        value = "";
      } else if (c === "\n") {
        row.push(value.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        value = "";
      } else {
        value += c;
      }
    }

    if (value.length || row.length) {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
    }

    return rows;
  }

  async function syncAcademicData() {
    const config = settings?.ACADEMIC_DATA;

    if (
      !config?.spreadsheetId ||
      config.provider !== "googleSheetsPublishedCsv"
    )
      return;

    const field = config.fields?.BTech;
    if (!field?.sheet || !field?.cell || !education[0]) return;

    const cacheKey = `academic-cache:${config.spreadsheetId}:${field.sheet}:${field.cell}`;

    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    } catch {}

    if (cached?.value !== undefined && cached?.value !== null) {
      education[0].cgpa = cached.value;
    }

    const status = $("#academic-status");
    const match = /^([A-Z]+)(\d+)$/i.exec(field.cell || "");

    if (!match) {
      if (status)
        status.textContent =
          "Academic data mapping needs a valid spreadsheet cell.";
      renderEducation();
      return;
    }

    let column = 0;
    for (const c of match[1].toUpperCase()) {
      column = column * 26 + c.charCodeAt(0) - 64;
    }

    const rowIndex = Number(match[2]) - 1;
    const columnIndex = column - 1;
    const gid = field.gid ?? config.gid;

    const url =
      gid !== undefined
        ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(config.spreadsheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`
        : `https://docs.google.com/spreadsheets/d/${encodeURIComponent(config.spreadsheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(field.sheet)}`;

    try {
      const response = await fetch(url, { mode: "cors", cache: "no-store" });
      if (!response.ok) throw new Error("Sheet is not publicly readable");

      const csv = await response.text();
      if (/<!doctype html|<html/i.test(csv)) {
        throw new Error("Google Sheets returned HTML instead of CSV");
      }

      const value = parseCSV(csv)[rowIndex]?.[columnIndex];
      const number = Number(
        String(value ?? "")
          .replace(/,/g, "")
          .trim(),
      );

      if (
        value === undefined ||
        String(value).trim() === "" ||
        !Number.isFinite(number)
      ) {
        throw new Error("Configured cell has no numeric value");
      }

      education[0].cgpa = Number(
        number.toFixed(Number(field.displayPrecision ?? 2)),
      );

      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            value: education[0].cgpa,
            updatedAt: Date.now(),
          }),
        );
      } catch {}

      if (status) {
        status.textContent = `Academic data synced from Google Sheets · ${new Date().toLocaleString()}`;
      }
    } catch (error) {
      if (status) {
        status.textContent = cached
          ? "Showing the last cached academic value; live sync was unavailable."
          : "Live CGPA sync is not available. Check the published sheet and cell mapping.";
      }
      console.info("Academic data sync skipped:", error.message);
    }

    renderEducation();
  }

  // ============================================================
  // 4. ROLE FAMILY AND PROFILE COMPATIBILITY
  // ============================================================

  const ROLE_FAMILY_PATTERNS = {
    education:
      /\b(teacher|teaching|educator|tutor|lecturer|professor|instructor|faculty|curriculum|cs teacher|computer science teacher)\b/i,
    legal:
      /\b(lawyer|attorney|legal|litigation|paralegal|solicitor|counsel|law associate|divorce lawyer|legal assistant)\b/i,
    embedded:
      /\b(embedded|firmware|microcontroller|microcontrollers|rtos|bare[\s-]?metal|iot|embedded systems)\b/i,
    robotics:
      /\b(robotics|robot|robotic|ros2?|autonomous systems?|kinematics|slam|motion planning)\b/i,
    software:
      /\b(software engineer|software developer|programmer|application developer|backend engineer|frontend engineer|full[\s-]?stack)\b/i,
    research:
      /\b(researcher|research engineer|research scientist|research assistant|scientific computing)\b/i,
    ai: /\b(ai engineer|artificial intelligence|machine learning|deep learning|ml engineer|computer vision|nlp engineer)\b/i,
    mechanical:
      /\b(mechanical engineer|mechanical design|cad designer|product designer|cnc|fabrication engineer)\b/i,
    web: /\b(web developer|web engineer|frontend|front[\s-]?end|backend|back[\s-]?end|full[\s-]?stack)\b/i,
    data: /\b(data scientist|data analyst|data engineer|business intelligence|analytics engineer)\b/i,
    electrical:
      /\b(electrical engineer|electronics engineer|pcb designer|circuit design|power electronics)\b/i,
  };

  const ROLE_FAMILY_TERMS = {
    education: [
      "teaching",
      "teacher",
      "educator",
      "curriculum",
      "lesson planning",
      "classroom",
    ],
    legal: [
      "law",
      "legal",
      "lawyer",
      "attorney",
      "litigation",
      "legal research",
      "case management",
    ],
    embedded: [
      "embedded systems",
      "firmware",
      "microcontroller",
      "rtos",
      "bare metal",
      "iot",
      "esp32",
      "stm32",
      "arduino",
    ],
    robotics: [
      "robotics",
      "robot",
      "ros",
      "ros2",
      "control systems",
      "kinematics",
      "slam",
      "motion planning",
      "autonomous systems",
    ],
    software: [
      "software engineering",
      "programming",
      "algorithms",
      "data structures",
      "testing",
      "debugging",
      "python",
      "c++",
      "java",
    ],
    research: [
      "research",
      "simulation",
      "experimentation",
      "scientific computing",
      "optimization",
      "research methodology",
    ],
    ai: [
      "artificial intelligence",
      "machine learning",
      "deep learning",
      "neural networks",
      "computer vision",
      "pytorch",
      "tensorflow",
      "nlp",
    ],
    mechanical: [
      "mechanical design",
      "cad",
      "3d printing",
      "3d modeling",
      "solidworks",
      "fusion 360",
      "cnc",
      "fabrication",
    ],
    web: [
      "web development",
      "html",
      "css",
      "javascript",
      "frontend",
      "backend",
      "react",
      "node.js",
      "databases",
    ],
    data: [
      "data science",
      "data analysis",
      "statistics",
      "sql",
      "pandas",
      "visualization",
      "analytics",
    ],
    electrical: [
      "electrical engineering",
      "electronics",
      "circuit design",
      "pcb",
      "power systems",
      "signal processing",
      "instrumentation",
    ],
  };

  function tokenize(value) {
    return [
      ...new Set(
        String(value || "")
          .toLowerCase()
          .replace(/c\+\+/g, " cpp ")
          .replace(/c#/g, " csharp ")
          .split(/[^a-z0-9+#.]+/)
          .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
      ),
    ];
  }

  function classifyRoleFamilies(title) {
    const families = new Set();
    const text = String(title || "").toLowerCase();

    for (const [family, pattern] of Object.entries(ROLE_FAMILY_PATTERNS)) {
      if (pattern.test(text)) families.add(family);
    }

    return families;
  }

  function profileEvidenceText() {
    return [
      currentProfile.name,
      currentProfile.title,
      currentProfile["about-me"],
      currentProfile["short-description"],
      ...education.flatMap((item) => [
        item.degree,
        item["field-of-study"],
        item.stream,
        item.college,
        item.university,
      ]),
      ...Object.entries(skills).flatMap(([category, items]) => [
        category,
        ...(Array.isArray(items) ? items : []),
      ]),
      ...projects.flatMap((item) => [
        item.name,
        item.description,
        ...(item.technologies || []),
      ]),
      ...experience.flatMap((item) => [
        item.position,
        item.company,
        item.description,
      ]),
      ...achievements.flatMap((item) =>
        typeof item === "string"
          ? [item]
          : [
              item.title,
              item.name,
              item.achievement,
              item.description,
              item.organization,
            ],
      ),
      ...memberships.flatMap((item) =>
        typeof item === "string" ? [item] : [item.name, item.organization],
      ),
      ...languages,
      ...(Array.isArray(info?.CURRENT_FOCUS) ? info.CURRENT_FOCUS : []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  /*
   * Determine the user's demonstrated families from profile evidence.
   * This is intentionally not inferred from the requested role.
   */
  function getProfileFamilies() {
    const evidence = [
      currentProfile.title,
      currentProfile["about-me"],
      ...education.flatMap((item) => [
        item.degree,
        item["field-of-study"],
        item.stream,
      ]),
      ...Object.entries(skills).flatMap(([category, items]) => [
        category,
        ...(Array.isArray(items) ? items : []),
      ]),
      ...projects.flatMap((project) => [
        project.name,
        project.description,
        ...(project.technologies || []),
      ]),
      ...experience.flatMap((item) => [
        item.position,
        item.company,
        item.description,
      ]),
    ]
      .filter(Boolean)
      .join(" ");

    return classifyRoleFamilies(evidence);
  }

  /*
   * Critical guard:
   * a role must have evidence in the profile before the CV generator runs.
   * Vacancy-feed failure is NOT itself a reason to reject a role, but it
   * is also NOT permission to create a CV for an unrelated profession.
   */
  function assessRoleCompatibility(role) {
    const targetFamilies = classifyRoleFamilies(role);
    const profileFamilies = getProfileFamilies();
    const evidence = profileEvidenceText();

    if (!String(role || "").trim()) {
      return {
        compatible: false,
        reason: "Enter a target job title first.",
      };
    }

    if (targetFamilies.size) {
      const overlap = [...targetFamilies].filter((family) =>
        profileFamilies.has(family),
      );

      if (overlap.length) {
        return {
          compatible: true,
          confidence: "family",
          families: overlap,
          reason: `Relevant profile families found: ${overlap.join(", ")}.`,
        };
      }

      return {
        compatible: false,
        confidence: "family",
        families: [...targetFamilies],
        reason:
          `Your current profile does not document experience, education, ` +
          `skills, or projects aligned with the ${[...targetFamilies].join(" / ")} ` +
          `role family.`,
      };
    }

    const roleTokens = tokenize(role);
    const matched = roleTokens.filter((token) => evidence.includes(token));
    const ratio = roleTokens.length ? matched.length / roleTokens.length : 0;

    if (matched.length > 0 && ratio >= 0.5) {
      return {
        compatible: true,
        confidence: "keyword",
        reason: `Potentially relevant profile terms: ${matched.join(", ")}.`,
      };
    }

    return {
      compatible: false,
      confidence: "keyword",
      reason:
        "The current profile does not contain enough relevant evidence for this role. " +
        "Add relevant skills, education, or projects before generating a tailored CV.",
    };
  }

  function roleFamiliesCompatible(targetRole, vacancyTitle) {
    const target = classifyRoleFamilies(targetRole);
    const vacancy = classifyRoleFamilies(vacancyTitle);

    if (target.size) {
      if (!vacancy.size) return false;
      return [...target].some((family) => vacancy.has(family));
    }

    const targetTokens = tokenize(targetRole);
    const vacancyTokens = tokenize(vacancyTitle);

    return (
      targetTokens.length > 0 &&
      targetTokens.some((token) => vacancyTokens.includes(token))
    );
  }

  function relevancePercent(text, role) {
    const haystack = String(text || "").toLowerCase();
    const families = classifyRoleFamilies(role);
    const roleTokens = tokenize(role);

    if (!haystack.trim() || !String(role || "").trim()) return 0;

    const directHits = roleTokens.filter((token) => haystack.includes(token));
    const directCoverage = roleTokens.length
      ? directHits.length / roleTokens.length
      : 0;

    if (directHits.length && directCoverage >= 0.75) return 100;

    const familyTerms = [...families].flatMap(
      (family) => ROLE_FAMILY_TERMS[family] || [],
    );

    const familyHits = [...new Set(familyTerms)].filter((term) =>
      haystack.includes(term.toLowerCase()),
    );

    if (families.size && familyHits.length >= 2) return 85;
    if (families.size && familyHits.some((term) => term.includes(" ")))
      return 85;
    if (families.size && familyHits.length === 1) return 75;

    return !families.size && directCoverage >= 0.75 && directHits.length
      ? 75
      : 0;
  }

  function orderedSkills(role) {
    return Object.entries(skills)
      .map(([category, values], categoryIndex) => ({
        category,
        categoryIndex,
        items: (Array.isArray(values) ? values : [])
          .map((item, index) => ({
            item: String(item),
            index,
            score: relevancePercent(`${category} ${item}`, role),
          }))
          .filter((entry) => entry.score >= SKILL_MATCH_THRESHOLD)
          .sort((a, b) => b.score - a.score || a.index - b.index),
      }))
      .filter((section) => section.items.length)
      .sort(
        (a, b) =>
          b.items.length - a.items.length || a.categoryIndex - b.categoryIndex,
      )
      .slice(0, 5)
      .map((section) => ({
        category: section.category,
        items: section.items.slice(0, 8).map((entry) => entry.item),
      }));
  }

  function orderedProjects(role) {
    return projects
      .map((project, index) => ({
        project,
        index,
        score: relevancePercent(
          `${project.name || ""} ${project.description || ""} ${(project.technologies || []).join(" ")}`,
          role,
        ),
      }))
      .filter((entry) => entry.score >= SKILL_MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 4)
      .map((entry) => entry.project);
  }

  // ============================================================
  // 5. CV GENERATION
  // ============================================================

  function assessRole(role) {
    const compatibility = assessRoleCompatibility(role);
    const profile = profileEvidenceText();
    const tokens = tokenize(role);
    const matched = tokens.filter((token) => profile.includes(token));

    if (!compatibility.compatible) {
      return {
        level: "poor",
        headline: "Insufficient role compatibility",
        notes: [compatibility.reason],
      };
    }

    return {
      level: matched.length ? "good" : "partial",
      headline: matched.length
        ? "Relevant profile evidence found"
        : "Role-family evidence found",
      notes: [
        compatibility.reason,
        matched.length
          ? `Documented matching terms: ${matched.join(", ")}.`
          : "The role family is relevant, but direct role keywords are limited.",
        "Review the finished CV to ensure every statement is accurate.",
      ],
    };
  }

  function renderCV(role, mode = "quick", options = {}) {
    const compatibility = assessRoleCompatibility(role);

    // Never allow this function to bypass the compatibility guard.
    if (!compatibility.compatible) {
      const preview = $("#cv-preview");
      const printButton = $("#print-cv");
      const closeButton = $("#close-cv");
      const assessment = $("#cv-assessment");

      if (preview) {
        preview.hidden = true;
        preview.replaceChildren();
      }
      if (printButton) printButton.disabled = true;
      if (closeButton) closeButton.hidden = true;

      if (assessment) {
        assessment.hidden = false;
        assessment.dataset.level = "poor";
        assessment.textContent = `CV not generated. ${compatibility.reason}`;
      }

      announce(`CV generation blocked. ${compatibility.reason}`);
      return false;
    }

    const assessment = $("#cv-assessment");
    const assessmentResult = options.assessment || assessRole(role);

    if (assessment && !options.silentAssessment) {
      assessment.hidden = false;
      assessment.dataset.level = assessmentResult.level || "good";
      assessment.replaceChildren();

      const heading = document.createElement("strong");
      heading.textContent =
        assessmentResult.headline || "Role compatibility reviewed";

      const list = document.createElement("ul");
      (assessmentResult.notes || []).forEach((note) => {
        const li = document.createElement("li");
        li.textContent = note;
        list.append(li);
      });

      assessment.append(heading, list);
    } else if (assessment) {
      assessment.hidden = true;
      assessment.replaceChildren();
    }

    const profile = currentProfile;
    const name = profile.name || "Candidate";
    const email = normalizeEmail(
      contact.email || contact.socials?.email?.url || "",
    );

    const cvLink = (label, rawUrl) => {
      const url = safeUrl(rawUrl);
      if (!url) return escapeHTML(label || "");
      const target =
        url.startsWith("mailto:") || url.startsWith("tel:")
          ? "_self"
          : "_blank";
      return `<a href="${escapeHTML(url)}" target="${target}" rel="noopener noreferrer">${escapeHTML(label || url)}</a>`;
    };

    const socialsHTML = Object.entries(contact.socials || {})
      .filter(([key]) => key !== "email")
      .map(([key, value]) => {
        const url = typeof value === "string" ? value : value?.url || "";
        const userId =
          typeof value === "object" && value
            ? value["user-id"] || value.userId || value.username || ""
            : "";
        return url ? cvLink(userId ? `${key}: ${userId}` : key, url) : "";
      })
      .filter(Boolean)
      .join(" · ");

    const emailHTML = email ? cvLink(email, `mailto:${email}`) : "";
    const phoneHTML = contact.phone
      ? cvLink(
          contact.phone,
          `tel:${String(contact.phone).replace(/[^+0-9]/g, "")}`,
        )
      : "";
    const locationHTML = escapeHTML(contact.location || "");
    const contactLine = [emailHTML, phoneHTML, locationHTML]
      .filter(Boolean)
      .join(" · ");

    const summary =
      String(profile["about-me"] || "").trim() ||
      buildShortDescription(profile);

    const skillSections = orderedSkills(role);
    const skillsHTML = skillSections
      .map(
        ({ category, items }) =>
          `<h4>${escapeHTML(category)}</h4><p>${escapeHTML(items.join(" · "))}</p>`,
      )
      .join("");

    const educationHTML = education
      .map((item) => {
        const duration = item.duration;
        const date =
          typeof duration === "string"
            ? duration
            : [duration?.start, duration?.end].filter(Boolean).join(" — ");
        const title = [item.degree, item["field-of-study"] || item.stream]
          .filter(Boolean)
          .join(" · ");
        const school = [item.college, item.university]
          .filter(Boolean)
          .join(" · ");

        return `<h4>${escapeHTML(title || "Education")}</h4><p>${escapeHTML(school)}${date ? ` · ${escapeHTML(date)}` : ""}</p>`;
      })
      .join("");

    const experienceHTML = experience
      .map((item) => {
        const duration = item.duration;
        const date =
          typeof duration === "string"
            ? duration
            : [
                duration?.start,
                duration?.end || (duration?.start ? "Present" : ""),
              ]
                .filter(Boolean)
                .join(" — ");

        return `<h4>${escapeHTML([item.position, item.company].filter(Boolean).join(" · "))}</h4><p>${escapeHTML(date)}</p>${item.description ? `<p>${escapeHTML(item.description)}</p>` : ""}`;
      })
      .join("");

    const achievementsHTML = achievements
      .map((item) => {
        const entry = typeof item === "string" ? { title: item } : item;
        return `<h4>${escapeHTML(entry.title || entry.name || entry.achievement || "Achievement")}</h4><p>${escapeHTML([entry.organization, entry.date || entry.year, entry.description].filter(Boolean).join(" · "))}</p>`;
      })
      .join("");

    const projectHTML = orderedProjects(role)
      .map((project) => {
        const technologies = Array.isArray(project.technologies)
          ? project.technologies.filter(Boolean)
          : [];
        const details = [
          project.description,
          technologies.length ? `Technologies: ${technologies.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" ");

        return `<h4>${escapeHTML(project.name || "Project")}</h4><p>${escapeHTML(details)}</p>`;
      })
      .join("");

    const memberHTML = memberships
      .map((item) =>
        escapeHTML(
          typeof item === "string"
            ? item
            : [item.name, item.organization].filter(Boolean).join(" · "),
        ),
      )
      .join("<br>");

    const cv = `
      <article class="cv-sheet">
        <header class="cv-header">
          <h2>${escapeHTML(name)}</h2>
          <p class="cv-target-role">${escapeHTML(role)}</p>
          <p>${contactLine}</p>
          <p>${socialsHTML}</p>
        </header>
        <div class="cv-columns">
          <aside>
            <h3>Skills</h3>
            ${skillsHTML || "<p>No matching skills documented for this role.</p>"}
            <h3>Community</h3>
            <p>${memberHTML || "Not listed"}</p>
            <h3>Languages</h3>
            <p>${escapeHTML(languages.join(" · "))}</p>
          </aside>
          <div>
            <h3>Professional Summary</h3>
            <p>${escapeHTML(summary)}</p>
            <h3>Education</h3>
            ${educationHTML || "<p>Education not configured.</p>"}
            ${experienceHTML ? `<h3>Experience</h3>${experienceHTML}` : ""}
            ${achievementsHTML ? `<h3>Achievements</h3>${achievementsHTML}` : ""}
            <h3>Projects</h3>
            ${projectHTML || "<p>No matching projects documented for this role.</p>"}
          </div>
        </div>
      </article>`;

    const preview = $("#cv-preview");
    if (preview) {
      preview.innerHTML = cv;
      preview.hidden = false;
    }

    if ($("#print-cv")) $("#print-cv").disabled = false;
    if ($("#close-cv")) $("#close-cv").hidden = false;

    announce("CV preview generated from documented profile information.");
    return true;
  }

  // ============================================================
  // 6. JOB-FEED DISCOVERY AND MATCHING
  // ============================================================

  function cleanText(value) {
    if (!value) return "";
    let text = String(value);

    for (let pass = 0; pass < 2; pass++) {
      const doc = new DOMParser().parseFromString(text, "text/html");
      const next = (doc.body.textContent || "").replace(/\s+/g, " ").trim();
      if (next === text) break;
      text = next;
    }

    return text
      .replace(/<\/?(?:p|div|span|br|li|ul|strong|em|b|i)\b[^>]*>/gi, " ")
      .replace(/&nbsp;|\u00a0/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeJob(job, source) {
    return {
      id: String(
        job.slug ||
          job.id ||
          job.url ||
          `${job.title || job.position}-${job.company_name || job.company || ""}`,
      ),
      title: String(job.title || job.position || "Untitled role").trim(),
      company: String(
        job.company_name ||
          job.company ||
          job.organization ||
          "Company not specified",
      ).trim(),
      location: String(
        job.location || (job.remote ? "Remote" : "Location not specified"),
      ).trim(),
      url: safeUrl(job.url || job.apply_url || job.job_url || ""),
      description: cleanText(
        job.description || job.summary || job.content || "",
      ),
      tags: Array.isArray(job.tags)
        ? job.tags.map(String)
        : Array.isArray(job.skills)
          ? job.skills.map(String)
          : [],
      source,
      remote: Boolean(job.remote),
    };
  }

  async function fetchJobFeeds(query) {
    const errors = [];
    const feeds = [];

    try {
      const response = await fetch(
        "https://www.arbeitnow.com/api/job-board-api",
        {
          headers: { Accept: "application/json" },
        },
      );
      if (!response.ok)
        throw new Error(`Arbeitnow returned ${response.status}`);

      const data = await response.json();
      const jobs = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];
      feeds.push(...jobs.map((job) => normalizeJob(job, "Arbeitnow")));
    } catch (error) {
      errors.push(`Arbeitnow: ${error.message}`);
    }

    try {
      const response = await fetch("https://remoteok.com/api", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`RemoteOK returned ${response.status}`);

      const data = await response.json();
      const jobs = Array.isArray(data)
        ? data.filter((item) => item?.position)
        : [];

      feeds.push(
        ...jobs.map((job) =>
          normalizeJob(
            {
              title: job.position,
              company: job.company,
              location:
                job.location ||
                (job.remote ? "Remote" : "Remote / not specified"),
              url: job.url,
              description: job.description,
              tags: job.tags,
              id: job.id,
              remote: true,
            },
            "RemoteOK",
          ),
        ),
      );
    } catch (error) {
      errors.push(`RemoteOK: ${error.message}`);
    }

    // Reject unrelated titles before examining descriptions or keywords.
    const filtered = feeds.filter((job) => {
      if (!roleFamiliesCompatible(query, job.title)) return false;

      const queryTokens = tokenize(query);
      const titleTokens = tokenize(job.title);
      const titleOverlap = queryTokens.filter((token) =>
        titleTokens.includes(token),
      ).length;
      const body = `${job.tags.join(" ")} ${job.description}`.toLowerCase();
      const bodyOverlap = queryTokens.filter((token) =>
        body.includes(token),
      ).length;

      return (
        titleOverlap > 0 ||
        bodyOverlap >= Math.min(2, Math.max(1, queryTokens.length))
      );
    });

    const unique = new Map();

    filtered.forEach((job) => {
      const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}|${job.url}`;
      if (!unique.has(key)) unique.set(key, job);
    });

    return { jobs: [...unique.values()].slice(0, 20), errors };
  }

  function calculateMatchScore(job, role) {
    if (!roleFamiliesCompatible(role, job.title)) {
      return {
        score: 0,
        matched: [],
        missing: tokenize(role).slice(0, 8),
        roleCompatible: false,
      };
    }

    const profile = profileEvidenceText();
    const jobText =
      `${job.title} ${(job.tags || []).join(" ")} ${job.description || ""}`.toLowerCase();

    const roleTerms = tokenize(role);
    const profileTerms = tokenize(profile);

    const relevantTerms = [
      ...new Set([
        ...roleTerms,
        ...profileTerms.filter((term) => jobText.includes(term)),
      ]),
    ];

    if (!relevantTerms.length) {
      return { score: 0, matched: [], missing: [], roleCompatible: true };
    }

    const matched = relevantTerms.filter(
      (term) => jobText.includes(term) && profile.includes(term),
    );
    const missing = relevantTerms.filter((term) => !matched.includes(term));
    const roleMatched = roleTerms.filter(
      (term) => jobText.includes(term) && profile.includes(term),
    );

    const roleCoverage = roleTerms.length
      ? roleMatched.length / roleTerms.length
      : 0;
    const profileCoverage = relevantTerms.length
      ? matched.length / relevantTerms.length
      : 0;
    const score = Math.round(
      Math.min(100, (roleCoverage * 0.55 + profileCoverage * 0.45) * 100),
    );

    return {
      score,
      matched: [...new Set([...roleMatched, ...matched])].slice(0, 10),
      missing: [...new Set(missing)].slice(0, 8),
      roleCompatible: true,
    };
  }

  function checkJobMatch(job) {
    const profile = profileEvidenceText();
    const description = job.description || "";

    if (description.length < 80) {
      return {
        status: "unknown",
        reasons: [
          "The feed did not provide enough job-description detail to assess mandatory requirements.",
        ],
      };
    }

    const sentences = description
      .replace(/([.!?])\s+/g, "$1\n")
      .split(/[\n•●▪◦]+/)
      .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
      .filter((line) => line.length >= 15 && line.length <= 420);

    const mandatoryPattern =
      /\b(required|required to|must have|must be|must possess|mandatory|essential|minimum qualification|minimum of|at least \d+ years|need to have|requirement is|you will need|eligible candidates must)\b/i;

    const mandatory = [
      ...new Set(sentences.filter((line) => mandatoryPattern.test(line))),
    ];

    if (!mandatory.length) {
      return {
        status: "pass",
        reasons: [
          "No clearly worded mandatory requirement was isolated. This is not proof of employer eligibility; review the original listing.",
        ],
      };
    }

    const failures = mandatory
      .map((line) => {
        const tokens = tokenize(line);
        const missing = tokens.filter((token) => !profile.includes(token));
        return {
          line,
          missing,
          pass: tokens.length > 0 && missing.length === 0,
        };
      })
      .filter((item) => !item.pass);

    if (failures.length) {
      return {
        status: "unknown",
        reasons: failures
          .slice(0, 5)
          .map(
            (item) =>
              `Requirement needs manual verification: ${item.line}` +
              (item.missing.length
                ? ` Missing profile terms: ${item.missing.slice(0, 6).join(", ")}.`
                : ""),
          ),
      };
    }

    return {
      status: "pass",
      reasons: [
        `All ${mandatory.length} detected mandatory statement(s) have matching profile keywords.`,
        "This keyword check is not a guarantee of employer eligibility.",
      ],
    };
  }

  // ============================================================
  // 7. JOB DESCRIPTION REQUIREMENT REVIEW
  // ============================================================

  function splitJobDescription(text) {
    return String(text || "")
      .replace(/\r/g, "")
      .split(/[\n•●▪◦]+|(?<=[.!?])\s+/)
      .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
      .filter((line) => line.length >= 12 && line.length <= 500);
  }

  function classifyRequirement(sentence) {
    const text = sentence.toLowerCase();

    if (
      /\b(preferred|desirable|nice to have|bonus|plus|ideally|would be an advantage)\b/.test(
        text,
      )
    ) {
      return "preferred";
    }

    if (
      /\b(required|must|required to|mandatory|minimum|need to|shall|essential|at least \d+ years|you will need)\b/.test(
        text,
      )
    ) {
      return "mandatory";
    }

    return "review";
  }

  function requirementEvidence(sentence) {
    const profile = profileEvidenceText();
    const tokens = tokenize(sentence);
    const matched = tokens.filter((token) => profile.includes(token));

    return {
      status: "UNKNOWN",
      evidence: matched.length
        ? `Possible profile overlap: ${matched.slice(0, 5).join(", ")}. Verify the specific requirement and cite evidence.`
        : "No direct evidence located in the current profile. Verify manually.",
    };
  }

  function extractRequirements() {
    const description = $("#cv-job-description")?.value.trim() || "";
    const role = $("#cv-role")?.value.trim() || "";
    const box = $("#cv-assessment");

    if (!box) return;

    if (!description) {
      box.hidden = false;
      box.dataset.level = "partial";
      box.textContent =
        "Paste a job description first, or generate a Quick CV from a compatible role.";
      return;
    }

    const unique = [...new Set(splitJobDescription(description))];

    extractedRequirements = unique.map((text, id) => ({
      id,
      text,
      classification: classifyRequirement(text),
      ...requirementEvidence(text),
    }));

    reviewedDescription = description;
    renderRequirementEditor();

    box.hidden = false;
    box.dataset.level = "partial";
    box.textContent =
      `Extracted ${extractedRequirements.length} candidate requirement(s)` +
      `${role ? ` for ${role}` : ""}. Review classifications and verify every mandatory status.`;

    if ($("#cv-requirements")) $("#cv-requirements").hidden = false;
  }

  function renderRequirementEditor() {
    const host = $("#cv-requirements");
    if (!host) return;
    host.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = "Review extracted requirements";

    const note = document.createElement("p");
    note.className = "form-hint";
    note.textContent =
      "PASS requires a written evidence note. UNKNOWN means unverified. Extraction is heuristic.";

    host.append(heading, note);

    extractedRequirements.forEach((requirement, index) => {
      const card = document.createElement("article");
      card.className = "requirement-card";

      const textLabel = document.createElement("label");
      textLabel.textContent = `Requirement ${index + 1}`;

      const text = document.createElement("textarea");
      text.rows = 2;
      text.value = requirement.text;
      text.addEventListener("input", () => {
        requirement.text = text.value.trim();
      });

      const typeLabel = document.createElement("label");
      typeLabel.textContent = "Classification";

      const type = document.createElement("select");
      [
        ["mandatory", "Mandatory"],
        ["preferred", "Preferred"],
        ["review", "Ambiguous — review"],
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        type.append(option);
      });
      type.value = requirement.classification;
      type.addEventListener("change", () => {
        requirement.classification = type.value;
      });

      const statusLabel = document.createElement("label");
      statusLabel.textContent = "Verification status";

      const status = document.createElement("select");
      [
        ["UNKNOWN", "UNKNOWN — not verified"],
        ["PASS", "PASS — evidence confirmed"],
        ["FAIL", "FAIL — not met"],
      ].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        status.append(option);
      });
      status.value = requirement.status;
      status.addEventListener("change", () => {
        requirement.status = status.value;
      });

      const evidenceLabel = document.createElement("label");
      evidenceLabel.textContent = "Evidence / verification note";

      const evidence = document.createElement("textarea");
      evidence.rows = 2;
      evidence.value = requirement.evidence || "";
      evidence.placeholder =
        "Add evidence from your skills, projects, or education.";
      evidence.addEventListener("input", () => {
        requirement.evidence = evidence.value.trim();
      });

      card.append(
        textLabel,
        text,
        typeLabel,
        type,
        statusLabel,
        status,
        evidenceLabel,
        evidence,
      );
      host.append(card);
    });
  }

  function checkEligibility() {
    if (!extractedRequirements.length) {
      return {
        ok: false,
        issues: [
          "Extract and review requirements from the job description first.",
        ],
      };
    }

    const issues = [];

    extractedRequirements.forEach((requirement, index) => {
      if (!requirement.text.trim()) {
        issues.push(`Requirement ${index + 1} is empty.`);
      }

      if (requirement.classification === "review") {
        issues.push(
          `Requirement ${index + 1} has an ambiguous classification.`,
        );
      }

      if (
        requirement.classification === "mandatory" &&
        requirement.status !== "PASS"
      ) {
        issues.push(
          `Mandatory requirement ${index + 1}: ${requirement.status}. ${requirement.text}`,
        );
      }

      if (
        requirement.classification === "mandatory" &&
        requirement.status === "PASS" &&
        !String(requirement.evidence || "").trim()
      ) {
        issues.push(
          `Mandatory requirement ${index + 1} is marked PASS but has no evidence note.`,
        );
      }
    });

    return { ok: issues.length === 0, issues };
  }

  function showEligibilityResult(result) {
    const box = $("#cv-assessment");
    if (!box) return;

    box.hidden = false;
    box.replaceChildren();
    box.dataset.level = result.ok ? "good" : "poor";

    const heading = document.createElement("strong");
    heading.textContent = result.ok
      ? "Mandatory requirements verified"
      : "CV generation blocked";

    const list = document.createElement("ul");
    const messages = result.ok
      ? [
          "Every mandatory requirement is marked PASS and has an evidence note. Review the CV for accuracy.",
        ]
      : result.issues;

    messages.forEach((message) => {
      const li = document.createElement("li");
      li.textContent = message;
      list.append(li);
    });

    box.append(heading, list);
  }

  // ============================================================
  // 8. CV CONTROLS AND FAIL-SAFE BEHAVIOUR
  // ============================================================

  function setupCV() {
    const roleInput = $("#cv-role");
    const generateButton = $("#generate-cv");
    const preview = $("#cv-preview");
    const printButton = $("#print-cv");
    const closeButton = $("#close-cv");
    const statusBox = $("#job-scout-status");
    const resultsHost = $("#job-scout-results");

    let searchSequence = 0;

    const setStatus = (message, level = "info") => {
      if (statusBox) {
        statusBox.hidden = false;
        statusBox.dataset.level = level;
        statusBox.textContent = message;
      }
      announce(message);
    };

    const clearPreview = () => {
      if (preview) {
        preview.hidden = true;
        preview.replaceChildren();
      }
      if (printButton) printButton.disabled = true;
      if (closeButton) closeButton.hidden = true;
    };

    const generateFromRole = (role) => {
      // Defence in depth: never generate from an incompatible role.
      const compatibility = assessRoleCompatibility(role);

      if (!compatibility.compatible) {
        clearPreview();
        setStatus(`CV not generated. ${compatibility.reason}`, "warning");

        const assessment = $("#cv-assessment");
        if (assessment) {
          assessment.hidden = false;
          assessment.dataset.level = "poor";
          assessment.textContent = `CV not generated. ${compatibility.reason}`;
        }
        return false;
      }

      const generated = renderCV(role, "quick", {
        skipAI: true,
        silentAssessment: true,
      });

      if (!generated) {
        clearPreview();
        return false;
      }

      if (statusBox) {
        statusBox.hidden = true;
        statusBox.textContent = "";
      }
      if (resultsHost) {
        resultsHost.hidden = true;
        resultsHost.replaceChildren();
      }

      if (preview) preview.hidden = false;
      if (printButton) printButton.disabled = false;
      if (closeButton) closeButton.hidden = false;

      announce(
        "Your role-tailored CV is ready. Only documented profile information was used.",
      );
      preview?.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    };

    generateButton?.addEventListener("click", async () => {
      const query = roleInput?.value.trim();

      if (!query) {
        setStatus("Enter your target job role first.", "warning");
        roleInput?.focus();
        return;
      }

      /*
       * IMPORTANT FIX:
       * Check profile compatibility BEFORE calling a job feed and BEFORE
       * generating any CV. The fallback cannot override this check.
       */
      const compatibility = assessRoleCompatibility(query);

      if (!compatibility.compatible) {
        searchSequence++;
        clearPreview();

        if (resultsHost) {
          resultsHost.hidden = true;
          resultsHost.replaceChildren();
        }

        const assessment = $("#cv-assessment");
        if (assessment) {
          assessment.hidden = false;
          assessment.dataset.level = "poor";
          assessment.textContent =
            `CV not generated. ${compatibility.reason} ` +
            "Choose a role aligned with your documented skills, education, or projects.";
        }

        setStatus(`CV not generated. ${compatibility.reason}`, "warning");
        return;
      }

      const sequence = ++searchSequence;

      generateButton.disabled = true;
      generateButton.textContent = "Searching jobs & matching profile…";
      clearPreview();

      if (resultsHost) {
        resultsHost.replaceChildren();
        resultsHost.hidden = true;
      }

      setStatus(
        "Checking compatible vacancies. If job feeds are unavailable, a profile-based CV will be generated only after the role compatibility check passes.",
      );

      try {
        const result = await fetchJobFeeds(query);
        if (sequence !== searchSequence) return;

        const evaluations = new Map();

        for (const job of result.jobs) {
          const match = calculateMatchScore(job, query);
          const requirements = checkJobMatch(job);

          const eligible =
            compatibility.compatible &&
            match.roleCompatible !== false &&
            match.score >= MATCH_THRESHOLD &&
            requirements.status === "pass";

          evaluations.set(job.id, {
            ...match,
            status: eligible
              ? "pass"
              : match.roleCompatible === false
                ? "fail"
                : "unknown",
            reasons: [
              `Compatibility score: ${match.score}% (minimum ${MATCH_THRESHOLD}%).`,
              ...(requirements.reasons || []),
              ...(match.missing.length
                ? [`Missing textual overlap: ${match.missing.join(", ")}.`]
                : []),
            ],
          });
        }

        const eligibleJobs = result.jobs
          .map((job, index) => ({
            job,
            index,
            evaluation: evaluations.get(job.id),
          }))
          .filter(
            (item) =>
              item.evaluation.status === "pass" &&
              item.evaluation.score >= MATCH_THRESHOLD,
          )
          .sort(
            (a, b) =>
              b.evaluation.score - a.evaluation.score || a.index - b.index,
          );

        /*
         * No vacancy is not the same as an incompatible career.
         * If the role itself is compatible, profile-based CV generation
         * remains available when feeds fail or return no suitable results.
         */
        if (!eligibleJobs.length && result.errors.length) {
          console.info("Job feeds unavailable or incomplete:", result.errors);
        }

        generateFromRole(query);
      } catch (error) {
        if (sequence !== searchSequence) return;

        console.info("Job-feed search failed:", error.message);

        // The same compatibility guard is applied inside this fallback.
        generateFromRole(query);
      } finally {
        if (sequence === searchSequence) {
          generateButton.disabled = false;
          generateButton.textContent = "Generate My CV";
        }
      }
    });

    roleInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        generateButton?.click();
      }
    });

    const fitCVForPrint = () => {
      const sheet = preview?.querySelector(".cv-sheet");
      if (!sheet || preview.hidden) return;

      sheet.style.setProperty("--cv-print-scale", "1");

      const availableHeight =
        sheet.clientHeight || sheet.getBoundingClientRect().height;
      const contentHeight = sheet.scrollHeight;

      const scale =
        contentHeight > availableHeight && availableHeight > 0
          ? Math.max(0.55, availableHeight / contentHeight)
          : 1;

      sheet.style.setProperty("--cv-print-scale", String(scale));
    };

    window.addEventListener("beforeprint", fitCVForPrint);

    window.addEventListener("afterprint", () => {
      preview
        ?.querySelector(".cv-sheet")
        ?.style.removeProperty("--cv-print-scale");
    });

    printButton?.addEventListener("click", () => {
      if (preview && !preview.hidden) {
        fitCVForPrint();
        window.print();
      }
    });

    closeButton?.addEventListener("click", () => {
      clearPreview();
      document.body.classList.remove("no-scroll");
      document.documentElement.style.removeProperty("overflow");
      document.body.style.removeProperty("overflow");
    });

    // Optional job-description controls, when present in the HTML.
    $("#extract-requirements")?.addEventListener("click", extractRequirements);
    $("#review-requirements")?.addEventListener("click", extractRequirements);
    $("#extract-job-requirements")?.addEventListener(
      "click",
      extractRequirements,
    );

    $("#generate-detailed-cv")?.addEventListener("click", () => {
      const role = roleInput?.value.trim() || "";
      const compatibility = assessRoleCompatibility(role);

      if (!compatibility.compatible) {
        showEligibilityResult({
          ok: false,
          issues: [compatibility.reason],
        });
        clearPreview();
        return;
      }

      const result = checkEligibility();
      showEligibilityResult(result);
      if (!result.ok) return;

      renderCV(role, "detailed", {
        skipAI: true,
        assessment: {
          level: "good",
          headline: "Mandatory requirements reviewed",
          notes: [
            "Review the CV carefully before submitting it.",
            "Requirement extraction and profile matching are heuristic.",
          ],
        },
      });
    });
  }

  // ============================================================
  // 9. ANIMATION AND APPLICATION INITIALIZATION
  // ============================================================

  function startParticles() {
    const canvas = $("#particleAccelerator");
    const ctx = canvas?.getContext("2d");

    if (
      !canvas ||
      !ctx ||
      settings?.ANIMATIONS?.enabled === false ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;

    const configured = Number(settings?.PARTICLES?.count);
    const count = Math.min(55, Math.max(0, configured || 35));
    const particles = [];

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    resize();

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      });
    }

    let frame = 0;
    let stopped = false;

    const draw = () => {
      if (stopped) return;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > window.innerWidth) p.vx *= -1;
        if (p.y < 0 || p.y > window.innerHeight) p.vy *= -1;

        ctx.fillStyle = "rgba(54,214,208,.65)";
        ctx.fillRect(p.x, p.y, 2, 2);

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const distance = Math.hypot(p.x - q.x, p.y - q.y);

          if (distance < 105) {
            ctx.strokeStyle = `rgba(54,214,208,${(1 - distance / 105) * 0.12})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }

      frame = window.requestAnimationFrame(draw);
    };

    window.addEventListener("resize", resize);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopped = true;
        window.cancelAnimationFrame(frame);
      } else if (stopped) {
        stopped = false;
        draw();
      }
    });

    draw();
  }

  async function main() {
    setupTheme();
    setupNavigation();
    setupCV();

    try {
      const [rawInfo, rawSettings] = await Promise.all([
        fetchJSON("assets/info.json"),
        fetchJSON("assets/settings.json"),
      ]);

      info = rawInfo;
      settings = rawSettings;

      currentProfile = normalizeData(rawInfo, rawSettings).profile;

      renderProfile(currentProfile);
      renderEducation();
      renderExperience();
      renderAchievements();
      updateOptionalSections();
      renderSkills();
      renderProjects();
      renderCommunity();
      renderContact();
      startParticles();

      await syncAcademicData();
    } catch (error) {
      console.error("Portfolio initialization failed:", error);

      const summary = $("#user-short-description");
      if (summary) {
        summary.textContent =
          "Portfolio data could not be loaded. Serve this site over HTTP and check assets/info.json and assets/settings.json.";
      }

      announce("Portfolio data failed to load.");
    } finally {
      window.setTimeout(
        hideLoadingScreen,
        settings?.LOADING_SCREEN?.durationMs || 500,
      );
    }
  }

  const projectDialog = $("#project-dialog");

  const closeProjectDialog = () => {
    if (projectDialog?.open && typeof projectDialog.close === "function") {
      projectDialog.close();
    } else {
      projectDialog?.removeAttribute("open");
    }

    document.documentElement.classList.remove("no-scroll");
    document.body.classList.remove("no-scroll");
    document.documentElement.style.removeProperty("overflow");
    document.body.style.removeProperty("overflow");
  };

  $("#project-dialog-close")?.addEventListener("click", closeProjectDialog);

  projectDialog?.addEventListener("click", (event) => {
    if (event.target === projectDialog) closeProjectDialog();
  });

  projectDialog?.addEventListener("close", () => {
    document.documentElement.classList.remove("no-scroll");
    document.body.classList.remove("no-scroll");
    document.documentElement.style.removeProperty("overflow");
    document.body.style.removeProperty("overflow");
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main, { once: true });
  } else {
    main();
  }
})();
