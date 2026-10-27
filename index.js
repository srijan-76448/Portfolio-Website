(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
  const safeUrl = (value) => {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const url = new URL(value.trim());
      return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  };

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

  const STORAGE_THEME = "portfolio-theme-v2";
  const REQUIREMENT_STOPWORDS = new Set([
    "and", "the", "with", "for", "from", "that", "this", "will", "are", "you", "your", "our",
    "have", "has", "into", "using", "use", "ability", "strong", "good", "excellent", "work",
    "working", "knowledge", "experience", "skills", "skill", "years", "year", "including", "required",
    "requirements", "preferred", "plus", "must", "should", "able", "such", "other", "role", "team",
    "teams", "responsibilities", "qualification", "qualifications", "who", "what", "their", "they",
  ]);

  function announce(message) {
    const status = $("#app-status");
    if (status) status.textContent = message;
  }

  async function fetchJSON(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Unable to load ${path} (${response.status})`);
    return response.json();
  }

  function normalizeData(rawInfo, rawSettings) {
    const v2 = Boolean(rawInfo.PROFILE || rawInfo.EDUCATION || rawInfo.PROJECTS);
    const oldUser = rawInfo["user-info"] || {};
    const profile = v2 ? (rawInfo.PROFILE || {}) : {
      name: oldUser["user-name"],
      title: oldUser["user-details"],
      "about-me": oldUser["about-me"],
      "short-description": oldUser["user-short-description"],
      "profile-image": oldUser["profile-pic"],
    };

    projects = (v2 ? rawInfo.PROJECTS || [] : rawInfo.projects || []).map((p) => ({
      ...p,
      url: typeof p.url === "string" ? p.url.trim() : "",
      description: p.description || p.descripton || "",
      technologies: Array.isArray(p.technologies) ? p.technologies : [],
    }));
    education = v2 && Array.isArray(rawInfo.EDUCATION) ? rawInfo.EDUCATION : [];
    experience = v2 && Array.isArray(rawInfo.EXPERIENCE) ? rawInfo.EXPERIENCE : [];
    achievements = v2 && Array.isArray(rawInfo.ACHIEVEMENTS) ? rawInfo.ACHIEVEMENTS : [];
    skills = v2 ? (rawInfo.SKILLS || {}) : (rawInfo.skills || {});
    memberships = v2 && Array.isArray(rawInfo.MEMBERSHIPS) ? rawInfo.MEMBERSHIPS : [];
    languages = v2 && Array.isArray(rawInfo.LANGUAGES) ? rawInfo.LANGUAGES : [];
    contact = v2 ? (rawInfo.CONTACT || {}) : (rawInfo.contact || {});

    if (!v2 && contact.socials) {
      contact = {
        ...contact,
        email: contact.socials.email?.url,
        socials: Object.fromEntries(Object.entries(contact.socials)
          .filter(([key]) => key !== "email")
          .map(([key, value]) => [key, { url: value.url, icon: key }])),
        message: contact["contact-text"] || "",
      };
    }
    return { profile, rawInfo, rawSettings };
  }

  function applyTheme() {
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_THEME); } catch { /* Storage may be disabled. */ }
    const theme = saved || settings?.THEME?.mode || "dark";
    document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
    const button = $("#theme-toggle");
    if (button) {
      button.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
      button.textContent = theme === "light" ? "☼" : "◐";
    }
  }

  function setupTheme() {
    applyTheme();
    $("#theme-toggle")?.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(STORAGE_THEME, next); } catch { /* Theme still works for this session. */ }
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
    $$("#site-nav a").forEach((link) => link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }));
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
    const skillNames = Object.values(skills).flat().map(String).map((s) => s.trim()).filter(Boolean).slice(0, 5);
    const projectNames = projects.map((p) => String(p.name || "").trim()).filter(Boolean).slice(0, 2);
    const field = education.map((item) => [item.degree, item["field-of-study"] || item.stream].filter(Boolean).join(" in ")).filter(Boolean)[0];
    const opening = name
      ? `${name} is a ${title.toLowerCase()} interested in building practical, reliable systems.`
      : `A ${title.toLowerCase()} interested in building practical, reliable systems.`;
    const parts = [opening];
    if (field) parts.push(`Academic background: ${field}.`);
    if (skillNames.length) parts.push(`Technical toolkit includes ${skillNames.join(", ")}.`);
    if (projectNames.length) parts.push(`Selected projects include ${projectNames.join(" and ")}.`);
    parts.push("Prefers open, maintainable engineering and hands-on problem solving.");
    const result = parts.join(" ").replace(/\s+/g, " ").trim();
    const words = result.split(/\s+/);
    return words.length > 60 ? `${words.slice(0, 60).join(" ").replace(/[,:;—-]+$/, "")}.` : result;
  }

  function renderProfile(profile) {
    document.title = `${profile.name || "Portfolio"}${settings?.BRANDING?.pageTitleSuffix || " | Robotics & Embedded Systems"}`;
    const icon = settings?.BRANDING?.logo || settings?.icon;
    if (icon && $("#web-icon")) $("#web-icon").href = icon;
    const authoredShort = String(profile["short-description"] || profile["user-short-description"] || "").trim();
    const about = String(profile["about-me"] || "").trim();
    $("#user-short-description").textContent = authoredShort && authoredShort.toLowerCase() !== about.toLowerCase()
      ? authoredShort : buildShortDescription(profile);
    $("#about-description").textContent = about || "Profile details will be available soon.";
    $("#current-focus").textContent = Array.isArray(info?.CURRENT_FOCUS) ? info.CURRENT_FOCUS.join("\n") : "";
    $("#working-principle").textContent = Array.isArray(info?.WORKING_PRINCIPLE) ? info.WORKING_PRINCIPLE.join("\n") : "";
    $("#footer-name").textContent = profile.name || "Portfolio";
    $("#current-year").textContent = new Date().getFullYear();
  }

  function renderEducation() {
    const host = $("#education-list");
    if (!host) return;
    host.replaceChildren();
    if (!education.length) {
      host.innerHTML = '<p class="muted">Education details are not configured in info.json yet.</p>';
      return;
    }
    education.forEach((item) => {
      const duration = item.duration;
      const date = typeof duration === "string" ? duration : [duration?.start, duration?.end].filter(Boolean).join(" — ");
      const card = document.createElement("article");
      card.className = "education-card";
      const left = document.createElement("div");
      const right = document.createElement("div");
      const degree = document.createElement("h3");
      degree.textContent = [item.degree, item["field-of-study"] || item.stream].filter(Boolean).join(" · ") || "Education";
      const school = document.createElement("p");
      school.textContent = [item.college, item.university].filter(Boolean).join(" · ");
      left.append(degree, school);
      const dates = document.createElement("div");
      dates.className = "education-date";
      dates.textContent = date || "";
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
      title.textContent = [item.position, item.company].filter(Boolean).join(" · ") || "Experience";
      left.append(title);
      if (item.description) {
        const description = document.createElement("p");
        description.textContent = item.description;
        left.append(description);
      }
      const duration = item.duration;
      const dates = document.createElement("div");
      dates.className = "education-date";
      dates.textContent = typeof duration === "string" ? duration : [duration?.start, duration?.end || (duration?.start ? "Present" : "")].filter(Boolean).join(" — ");
      right.append(dates);
      card.append(left, right);
      host.append(card);
    });
    if (!experience.length) host.innerHTML = '<p class="muted">No professional experience has been added yet.</p>';
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
      title.textContent = entry.title || entry.name || entry.achievement || "Achievement";
      left.append(title);
      const details = [entry.organization, entry.category].filter(Boolean).join(" · ");
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
    if (!achievements.length) host.innerHTML = '<p class="muted">No achievements have been added yet.</p>';
  }

  function updateOptionalSections() {
    [{ id: "experience", hasItems: experience.length > 0 }, { id: "achievements", hasItems: achievements.length > 0 }].forEach(({ id, hasItems }) => {
      const section = document.getElementById(id);
      const link = document.querySelector(`#site-nav a[href="#${id}"]`);
      if (section) section.hidden = !hasItems;
      if (link) link.hidden = !hasItems;
    });
  }

  function parseCSV(text) {
    const rows = [];
    let row = [], value = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { value += '"'; i++; }
        else if (char === '"') quoted = false;
        else value += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { row.push(value); value = ""; }
      else if (char === "\n") { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
      else value += char;
    }
    if (value.length || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
    return rows;
  }

  async function syncAcademicData() {
    const config = settings?.ACADEMIC_DATA;
    if (!config?.spreadsheetId || config.provider !== "googleSheetsPublishedCsv") return;
    const field = config.fields?.BTech;
    if (!field?.sheet || !field?.cell || !education[0]) return;
    const cacheKey = `academic-cache:${config.spreadsheetId}:${field.sheet}:${field.cell}`;
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(cacheKey) || "null"); } catch { /* Ignore invalid cache. */ }
    if (cached && cached.value !== undefined && cached.value !== null) education[0].cgpa = cached.value;
    const status = $("#academic-status");
    const match = /^([A-Z]+)(\d+)$/i.exec(field.cell || "");
    if (!match) { if (status) status.textContent = "Academic data mapping needs a valid spreadsheet cell."; return; }
    let col = 0;
    for (const char of match[1].toUpperCase()) col = col * 26 + char.charCodeAt(0) - 64;
    const index = { row: Number(match[2]) - 1, col: col - 1 };
    const gid = field.gid ?? config.gid;
    const url = gid !== undefined
      ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(config.spreadsheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`
      : `https://docs.google.com/spreadsheets/d/${encodeURIComponent(config.spreadsheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(field.sheet)}`;
    try {
      const response = await fetch(url, { mode: "cors", cache: "no-store" });
      if (!response.ok) throw new Error("Sheet is not publicly readable");
      const csv = await response.text();
      if (/<!doctype html|<html/i.test(csv)) throw new Error("Google Sheets returned HTML instead of CSV");
      const value = parseCSV(csv)[index.row]?.[index.col];
      const number = Number(String(value ?? "").replace(/,/g, "").trim());
      if (value === undefined || String(value).trim() === "" || !Number.isFinite(number)) throw new Error("Configured cell has no numeric value");
      education[0].cgpa = Number(number.toFixed(Number(field.displayPrecision ?? 2)));
      try { localStorage.setItem(cacheKey, JSON.stringify({ value: education[0].cgpa, updatedAt: Date.now() })); } catch { /* Cache is optional. */ }
      if (status) status.textContent = `Academic data synced from Google Sheets · ${new Date().toLocaleString()}`;
    } catch (error) {
      if (status) status.textContent = cached
        ? "Showing the last cached academic value; live sync was unavailable."
        : "Live CGPA sync is not available. Check that the sheet is publicly published and the tab/cell mapping is correct.";
      console.info("Academic data sync skipped:", error.message);
    }
    renderEducation();
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
    description.textContent = project["long-description"] || project.description || "No description available.";
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
      button.setAttribute("aria-label", `View details for ${project.name || "project"}`);
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
      kind.textContent = project.technologies.slice(0, 3).join(" / ") || "ENGINEERING";
      const more = document.createElement("span");
      more.textContent = "VIEW DETAILS ↗";
      footer.append(kind, more);
      button.append(art, body, footer);
      button.addEventListener("click", () => openProject(project, index));
      host.append(button);
    });
    if (!projects.length) host.innerHTML = '<p class="muted">Projects will appear here when added to info.json.</p>';
  }

  function renderCommunity() {
    const list = $("#memberships-list");
    if (list) {
      list.replaceChildren();
      memberships.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = typeof item === "string" ? item : [item.name, item.organization].filter(Boolean).join(" · ");
        list.append(li);
      });
      if (!memberships.length) list.innerHTML = "<li>Add community memberships in info.json to show them here.</li>";
    }
    const languageHost = $("#languages-list");
    if (languageHost) {
      languageHost.replaceChildren();
      languages.forEach((item) => { const span = document.createElement("span"); span.textContent = item; languageHost.append(span); });
      if (!languages.length) languageHost.innerHTML = "<span>Languages not configured</span>";
    }
  }

  function normalizeEmail(value) {
    return String(value || "").trim().replace(/^mailto:/i, "").split(/[?;]/, 1)[0];
  }

  function renderContact() {
    const email = normalizeEmail(contact.email || contact.socials?.email?.url || "");
    const description = $("#contact-description");
    if (description) description.textContent = contact.message || contact["contact-text"] || "Reach out for engineering conversations, open-source collaboration, and robotics projects.";
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
        const url = safeUrl(typeof item === "string" ? item : item.url);
        if (!url) return;
        const link = document.createElement("a");
        link.className = "social-link";
        link.href = url;
        if (!url.startsWith("mailto:") && !url.startsWith("tel:")) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
        link.textContent = name === "x" ? "X" : name.charAt(0).toUpperCase() + name.slice(1);
        socialHost.append(link);
      });
    }
    const form = $("#contact-form");
    if (form) form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!email) { announce("Contact email is not configured in assets/info.json."); return; }
      const name = $("#name").value.trim();
      const sender = $("#email").value.trim();
      const message = $("#message").value.trim();
      const subject = encodeURIComponent(`Portfolio enquiry from ${name}`);
      const body = encodeURIComponent(`Name: ${name}\nReply email: ${sender}\n\n${message}`);
      announce("Opening your email application…");
      window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    });
  }

  function assessRole(role) {
    // Offline fallback: infer overlap from the actual profile data, without role-family lists.
    const roleTokens = String(role || "").toLowerCase().split(/[^a-z0-9+#.]+/).filter((token) => token.length > 2);
    const evidence = [
      ...Object.keys(skills), ...Object.values(skills).flat(),
      ...projects.flatMap((project) => [project.name, project.description, ...(project.technologies || [])]),
      ...education.flatMap((item) => [item.degree, item["field-of-study"], item.stream]),
      ...experience.flatMap((item) => [item.position, item.company, item.description]),
      ...achievements.flatMap((item) => typeof item === "string" ? [item] : [item.title, item.name, item.achievement, item.description]),
      ...memberships.flatMap((item) => typeof item === "string" ? [item] : [item.name, item.organization]),
    ].filter(Boolean).join(" ").toLowerCase();
    const matched = roleTokens.filter((token) => evidence.includes(token));
    const ratio = roleTokens.length ? matched.length / roleTokens.length : 0;
    const level = ratio >= 0.6 ? "good" : ratio > 0 ? "partial" : "poor";
    const notes = [];
    if (!matched.length) notes.push(`The local fallback found no direct keyword overlap for “${role}”. This is not proof that you are unqualified; review the profile manually.`);
    else notes.push(`The local fallback found overlap for: ${matched.join(", ")}.`);
    notes.push("AI assessment is unavailable, so this result uses a simple profile-text comparison. Missing information is undocumented, not necessarily absent.");
    return { level, headline: level === "good" ? "Relevant profile evidence found" : level === "partial" ? "Some documented overlap" : "Limited direct textual overlap", notes };
  }

  function profileForAI() {
    // Send only the currently loaded profile data; never ask the model to invent facts.
    return {
      profile: currentProfile,
      education,
      skills,
      projects: projects.map(({ name, description, technologies, status }) => ({ name, description, technologies, status })),
      experience,
      achievements,
      memberships,
      languages,
      currentFocus: Array.isArray(info?.CURRENT_FOCUS) ? info.CURRENT_FOCUS : [],
    };
  }

  async function requestRoleAI(role) {
    try {
      const response = await fetch("/api/assess-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, profile: profileForAI() }),
      });
      if (!response.ok) throw new Error(`AI endpoint returned ${response.status}`);
      const data = await response.json();
      if (!data || !["good", "partial", "poor"].includes(data.level) || typeof data.headline !== "string" || !Array.isArray(data.notes) || !Array.isArray(data.keywords)) throw new Error("Invalid AI response schema");
      return {
        level: data.level,
        headline: data.headline.slice(0, 160),
        notes: data.notes.filter((item) => typeof item === "string").slice(0, 6).map((item) => item.slice(0, 400)),
        keywords: data.keywords.filter((item) => typeof item === "string" && item.trim()).slice(0, 20).map((item) => item.trim().slice(0, 60)),
        source: "ollama",
      };
    } catch (error) {
      console.info("Local AI unavailable; using profile-based fallback:", error.message);
      return null;
    }
  }

  // Generic token matching is only a fallback. When Ollama is available, model-generated keywords are used.
  let activeAIKeywords = [];
  // Expand common role terms to related concepts, but only select items that actually exist
  // in the verified profile. This improves relevance without inventing qualifications.
  const ROLE_FAMILIES = {
    embedded: ["embedded systems", "firmware", "microcontroller", "microcontrollers", "mcu", "rtos", "bare metal", "iot", "hardware", "electronics", "c", "c++", "esp32", "stm32", "arduino"],
    robotics: ["robotics", "robot", "robotic", "ros", "ros2", "control systems", "kinematics", "localization", "slam", "motion planning", "sensors", "actuators", "computer vision", "autonomous systems"],
    software: ["software engineering", "programming", "algorithms", "data structures", "testing", "debugging", "git", "api", "python", "c++", "java", "javascript"],
    research: ["research", "simulation", "experimentation", "scientific computing", "machine learning", "deep learning", "optimization", "publication"],
    ai: ["artificial intelligence", "machine learning", "deep learning", "neural networks", "computer vision", "data science", "pytorch", "tensorflow", "nlp"],
    mechanical: ["mechanical design", "cad", "3d printing", "3d modeling", "solidworks", "fusion 360", "cnc", "fabrication", "mechanisms"],
    web: ["web development", "html", "css", "javascript", "frontend", "backend", "react", "node.js", "apis", "databases"],
    data: ["data science", "data analysis", "statistics", "sql", "pandas", "visualization", "machine learning", "python"]
  };

  function roleKeywords(role) {
    const roleText = String(role || "").toLowerCase();
    const tokens = roleText.split(/[^a-z0-9+#.]+/).filter((word) => word.length > 2);
    const expanded = [];
    for (const [family, terms] of Object.entries(ROLE_FAMILIES)) {
      if (roleText.includes(family) || (family === "embedded" && /firmware|microcontroller|iot/.test(roleText)) || (family === "robotics" && /robot|autonomous/.test(roleText)) || (family === "ai" && /artificial intelligence|machine learning|deep learning/.test(roleText)) || (family === "web" && /frontend|backend|full.?stack|web developer/.test(roleText)) || (family === "data" && /data analyst|data scientist|analytics/.test(roleText))) expanded.push(...terms);
    }
    return [...new Set([...activeAIKeywords, ...tokens, ...expanded])];
  }

  const SKILL_MATCH_THRESHOLD = 75;

  function relevancePercent(text, role) {
    const haystack = String(text || "").toLowerCase();
    const roleText = String(role || "").toLowerCase();
    if (!haystack.trim() || !roleText.trim()) return 0;

    // Exact role phrases are strongest evidence. Related concepts are accepted only
    // when they belong to a recognized role family, and are still sourced from the profile.
    const roleTokens = roleText.split(/[^a-z0-9+#.]+/).filter((word) => word.length > 2 && !REQUIREMENT_STOPWORDS.has(word));
    const directHits = roleTokens.filter((token) => haystack.includes(token));
    const directCoverage = roleTokens.length ? directHits.length / roleTokens.length : 0;

    const familyTerms = [];
    for (const [family, terms] of Object.entries(ROLE_FAMILIES)) {
      const familyMatch = roleText.includes(family) ||
        (family === "embedded" && /firmware|microcontroller|iot/.test(roleText)) ||
        (family === "robotics" && /robot|autonomous/.test(roleText)) ||
        (family === "ai" && /artificial intelligence|machine learning|deep learning/.test(roleText)) ||
        (family === "web" && /frontend|backend|full.?stack|web developer/.test(roleText)) ||
        (family === "data" && /data analyst|data scientist|analytics/.test(roleText));
      if (familyMatch) familyTerms.push(...terms);
    }
    const familyHits = [...new Set(familyTerms)].filter((term) => haystack.includes(term.toLowerCase()));

    // Keep the score interpretable: 100 for direct title evidence plus a strong
    // related-family signal; 75 for a meaningful family match; otherwise below threshold.
    if (directCoverage >= 0.75 && directHits.length) return 100;
    if (familyHits.length >= 2 || (familyHits.length === 1 && familyHits[0].includes(" "))) return 85;
    if (familyHits.length === 1 || directHits.length) return 75;
    return 0;
  }

  function orderedSkills(role) {
    const ranked = Object.entries(skills).map(([category, values], originalIndex) => {
      const items = (Array.isArray(values) ? values : []).map((item, index) => ({
        item, index, score: relevancePercent(`${category} ${item}`, role),
      })).filter((entry) => entry.score >= SKILL_MATCH_THRESHOLD)
        .sort((a, b) => b.score - a.score || a.index - b.index);
      return { category, items, originalIndex, score: items.reduce((sum, entry) => sum + entry.score, 0) };
    }).sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex);

    // Only include skills meeting the configured 75% relevance threshold.
    // Never pad the CV with unrelated skills just to fill space.
    return ranked.filter((section) => section.items.length > 0).slice(0, 5).map((section) => ({
      ...section, items: section.items.slice(0, 8).map((entry) => entry.item),
    }));
  }

  function orderedProjects(role) {
    const ranked = projects.map((project, index) => ({
      project, index,
      score: relevancePercent(`${project.name || ""} ${project.description || ""} ${(project.technologies || []).join(" ")}`, role),
    })).filter((entry) => entry.score >= SKILL_MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score || a.index - b.index);
    // Include only documented projects with at least 75% role relevance.
    return ranked.slice(0, 4).map((entry) => entry.project);
  }

  function renderCV(role, mode = "quick", options = {}) {
    const box = $("#cv-assessment");
    const assessment = options.assessment || assessRole(role);
    const renderAssessment = (result, sourceLabel = "local fallback") => {
      box.hidden = false;
      box.dataset.level = mode === "detailed" ? "good" : result.level;
      box.replaceChildren();
      const heading = document.createElement("strong");
      heading.textContent = mode === "detailed" ? "Detailed job-description review completed" : `${result.headline} (${sourceLabel})`;
      box.append(heading);
      const list = document.createElement("ul");
      const notes = mode === "detailed" ? [
        "Mandatory requirements passed the review you completed. Check the CV and evidence notes carefully before submitting.",
        "Requirement extraction and profile matching are heuristic; this is not a guarantee of vacancy eligibility.",
      ] : [...result.notes, "AI supports relevance analysis only; it does not establish eligibility or add qualifications to your CV."];
      notes.forEach((note) => { const li = document.createElement("li"); li.textContent = note; list.append(li); });
      box.append(list);
    };
    if (options.silentAssessment) {
      box.hidden = true;
      box.replaceChildren();
    } else {
      renderAssessment(assessment);
    }
    if (mode === "quick" && !options.skipAI && !options.silentAssessment) {
      requestRoleAI(role).then((ai) => {
        if (!ai || !$("#cv-preview") || $("#cv-preview").hidden || $("#cv-role")?.value.trim() !== role) return;
        activeAIKeywords = ai.keywords;
        // Re-render with model-derived relevance keywords, then display the validated model assessment.
        renderCV(role, "quick", { skipAI: true, assessment: ai });
      });
    }

    const profile = currentProfile;
    const name = profile.name || "Candidate";
    const email = normalizeEmail(contact.email || contact.socials?.email?.url || "");
    const cvLink = (label, rawUrl) => {
      const url = safeUrl(rawUrl);
      return url ? `<a href="${escapeHTML(url)}" target="${url.startsWith("mailto:") || url.startsWith("tel:") ? "_self" : "_blank"}" rel="noopener noreferrer">${escapeHTML(label || url)}</a>` : escapeHTML(label || "");
    };
    const socialsHTML = Object.entries(contact.socials || {}).filter(([key]) => key !== "email").map(([key, value]) => {
      const url = typeof value === "string" ? value : value?.url || "";
      const userId = typeof value === "object" && value ? (value["user-id"] || value.userId || value.username || "") : "";
      // Prefer the configured handle as visible text, while linking it to the real profile URL.
      const label = userId ? `${key}: ${userId}` : key;
      return url ? cvLink(label, url) : "";
    }).filter(Boolean).join(" · ");
    const emailHTML = email ? cvLink(email, `mailto:${email}`) : "";
    const about = buildShortDescription(profile);
    const skillSections = orderedSkills(role);
    const educationHTML = education.map((item) => {
      const duration = item.duration;
      const date = typeof duration === "string" ? duration : [duration?.start, duration?.end].filter(Boolean).join(" — ");
      return `<h4>${escapeHTML([item.degree, item["field-of-study"] || item.stream].filter(Boolean).join(" · "))}</h4><p class="cv-muted">${escapeHTML([item.college, item.university].filter(Boolean).join(" · "))}${date ? ` · ${escapeHTML(date)}` : ""}</p>`;
    }).join("");
    const experienceHTML = experience.map((item) => {
      const duration = item.duration;
      const date = typeof duration === "string" ? duration : [duration?.start, duration?.end || (duration?.start ? "Present" : "")].filter(Boolean).join(" — ");
      return `<h4>${escapeHTML([item.position, item.company].filter(Boolean).join(" · "))}</h4><p class="cv-muted">${escapeHTML(date)}</p>${item.description ? `<p>${escapeHTML(item.description)}</p>` : ""}`;
    }).join("");
    const achievementsHTML = achievements.map((item) => {
      const entry = typeof item === "string" ? { title: item } : item;
      return `<h4>${escapeHTML(entry.title || entry.name || entry.achievement || "Achievement")}</h4><p>${escapeHTML([entry.organization, entry.date || entry.year, entry.description].filter(Boolean).join(" · "))}</p>`;
    }).join("");
    const projectHTML = orderedProjects(role).map((project) => {
      const technologies = Array.isArray(project.technologies) ? project.technologies.filter(Boolean) : [];
      const details = [project.description, technologies.length ? `Technologies: ${technologies.join(", ")}` : ""].filter(Boolean).join(" ");
      return `<h4>${escapeHTML(project.name || "Project")}</h4><p>${escapeHTML(details)}</p>`;
    }).join("");
    const skillsHTML = skillSections.map(({ category, items }) => `<h4>${escapeHTML(category)}</h4><p>${escapeHTML(items.join(" · "))}</p>`).join("");
    const memberHTML = memberships.map((item) => escapeHTML(typeof item === "string" ? item : [item.name, item.organization].filter(Boolean).join(" · "))).join("<br>");
    const phoneHTML = contact.phone ? cvLink(contact.phone, `tel:${String(contact.phone).replace(/[^+0-9]/g, "")}`) : "";
    const locationHTML = escapeHTML(contact.location || "");
    const contactLine = [emailHTML, phoneHTML, locationHTML].filter(Boolean).join(" · ");
    const cv = `<article class="cv-sheet"><header class="cv-header"><h2>${escapeHTML(name)}</h2><p class="cv-target-role">${escapeHTML(role)}</p><p>${contactLine}</p><p>${socialsHTML}</p></header><div class="cv-columns"><aside><h3>Skills</h3>${skillsHTML}<h3>Community</h3><p>${memberHTML || "Not listed"}</p><h3>Languages</h3><p>${escapeHTML(languages.join(" · "))}</p></aside><div><h3>Professional Summary</h3><p>${escapeHTML(about)}</p><h3>Education</h3>${educationHTML || "<p>Education not configured.</p>"}${experienceHTML ? `<h3>Experience</h3>${experienceHTML}` : ""}${achievementsHTML ? `<h3>Achievements</h3>${achievementsHTML}` : ""}<h3>Projects</h3>${projectHTML || "<p>Projects not configured.</p>"}</div></div></article>`;
    $("#cv-preview").innerHTML = cv;
    $("#cv-preview").hidden = false;
    $("#print-cv").disabled = false;
    $("#close-cv").hidden = false;
    announce("CV preview generated.");
  }

  function jobProfileText() {
    return [
      currentProfile.name, currentProfile.title, currentProfile["about-me"],
      ...education.flatMap((item) => [item.degree, item["field-of-study"], item.stream, item.college, item.university]),
      ...Object.entries(skills).flatMap(([category, items]) => [category, ...(Array.isArray(items) ? items : [])]),
      ...projects.flatMap((item) => [item.name, item.description, ...(item.technologies || [])]),
      ...experience.flatMap((item) => [item.position, item.company, item.description]),
      ...achievements.flatMap((item) => typeof item === "string" ? [item] : [item.title, item.name, item.achievement, item.description, item.organization]),
      ...memberships.flatMap((item) => typeof item === "string" ? [item] : [item.name, item.organization]),
      ...languages, ...(Array.isArray(info?.CURRENT_FOCUS) ? info.CURRENT_FOCUS : []),
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function splitJobDescription(text) {
    return text.replace(/\r/g, "").split(/[\n•●▪◦]+|(?<=[.!?])\s+/)
      .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
      .filter((line) => line.length >= 12 && line.length <= 500);
  }

  function classifyRequirement(sentence) {
    const text = sentence.toLowerCase();
    if (/\b(preferred|desirable|nice to have|bonus|plus|ideally|would be an advantage)\b/.test(text)) return "preferred";
    if (/\b(required|must|required to|mandatory|minimum|need to|shall|essential|at least \d+ years|you will need)\b/.test(text)) return "mandatory";
    return "review";
  }

  function requirementEvidence(sentence) {
    const normalized = sentence.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ");
    const tokens = [...new Set(normalized.split(/\s+/).filter((token) => token.length > 2 && !REQUIREMENT_STOPWORDS.has(token)))];
    const profile = jobProfileText();
    const exactPhrases = [
      ...Object.values(skills).flat().map(String),
      ...projects.flatMap((project) => [project.name, project.description, ...(project.technologies || [])].filter(Boolean)),
      ...education.flatMap((item) => [item.degree, item["field-of-study"], item.stream].filter(Boolean)),
    ].map((value) => String(value).toLowerCase());
    const matched = exactPhrases.filter((phrase) => phrase.length > 2 && normalized.includes(phrase));
    const tokenMatches = tokens.filter((token) => profile.includes(token));
    return {
      status: "UNKNOWN",
      evidence: matched.length || tokenMatches.length
        ? `Possible profile overlap: ${tokenMatches.slice(0, 5).join(", ") || "relevant phrase"}. Verify the specific requirement and cite actual evidence.`
        : "No direct evidence located in the current profile. Add evidence or mark FAIL if confirmed unmet.",
    };
  }

  function extractRequirements() {
    const role = $("#cv-role").value.trim();
    const description = $("#cv-job-description").value.trim();
    const box = $("#cv-assessment");
    if (!description) {
      box.hidden = false;
      box.dataset.level = "partial";
      box.textContent = "No job description entered. Generate a Quick CV directly from the job title, or paste a description for detailed verification.";
      return;
    }
    const unique = [];
    const seen = new Set();
    splitJobDescription(description).forEach((sentence) => {
      const key = sentence.toLowerCase();
      if (!seen.has(key)) { seen.add(key); unique.push(sentence); }
    });
    extractedRequirements = unique.map((text, id) => ({ id, text, classification: classifyRequirement(text), ...requirementEvidence(text), evidence: requirementEvidence(text).evidence }));
    reviewedDescription = description;
    renderRequirementEditor();
    box.hidden = false;
    box.dataset.level = "partial";
    box.textContent = `Extracted ${extractedRequirements.length} candidate requirement(s)${role ? ` for ${role}` : ""}. Review classifications and verify every mandatory status. Extraction is heuristic.`;
    $("#cv-requirements").hidden = false;
    if (!extractedRequirements.length) {
      box.textContent = "No requirements could be extracted. Try a longer job description or generate a Quick CV from the title.";
    }
  }

  function renderRequirementEditor() {
    const host = $("#cv-requirements");
    host.replaceChildren();
    if (!extractedRequirements.length) { host.textContent = "No requirements extracted yet."; return; }
    const heading = document.createElement("h3");
    heading.textContent = "Review extracted requirements";
    host.append(heading);
    const note = document.createElement("p");
    note.className = "form-hint";
    note.textContent = "PASS requires a written evidence note. UNKNOWN means unverified. Review ambiguous classifications before continuing.";
    host.append(note);

    extractedRequirements.forEach((requirement, index) => {
      const card = document.createElement("article");
      card.className = "requirement-card";
      const textLabel = document.createElement("label");
      textLabel.textContent = `Requirement ${index + 1}`;
      const text = document.createElement("textarea");
      text.rows = 2;
      text.value = requirement.text;
      text.setAttribute("aria-label", `Requirement ${index + 1} text`);
      text.addEventListener("input", () => { requirement.text = text.value.trim(); });

      const fields = document.createElement("div");
      fields.className = "requirement-fields";
      const typeWrap = document.createElement("div");
      const typeLabel = document.createElement("label");
      typeLabel.textContent = "Classification";
      const type = document.createElement("select");
      [["mandatory", "Mandatory"], ["preferred", "Preferred"], ["review", "Ambiguous — review"]].forEach(([value, label]) => {
        const option = document.createElement("option"); option.value = value; option.textContent = label; type.append(option);
      });
      type.value = requirement.classification;
      type.addEventListener("change", () => { requirement.classification = type.value; });
      typeWrap.append(typeLabel, type);

      const statusWrap = document.createElement("div");
      const statusLabel = document.createElement("label");
      statusLabel.textContent = "Verification status";
      const status = document.createElement("select");
      [["UNKNOWN", "UNKNOWN — not verified"], ["PASS", "PASS — evidence confirmed"], ["FAIL", "FAIL — not met"]].forEach(([value, label]) => {
        const option = document.createElement("option"); option.value = value; option.textContent = label; status.append(option);
      });
      status.value = requirement.status;
      status.addEventListener("change", () => { requirement.status = status.value; });
      statusWrap.append(statusLabel, status);
      fields.append(typeWrap, statusWrap);

      const evidenceLabel = document.createElement("label");
      evidenceLabel.textContent = "Evidence / verification note";
      const evidence = document.createElement("textarea");
      evidence.rows = 2;
      evidence.value = requirement.evidence || "";
      evidence.placeholder = "Cite a skill, project, education detail, or other verifiable profile evidence.";
      evidence.setAttribute("aria-label", `Evidence for requirement ${index + 1}`);
      evidence.addEventListener("input", () => { requirement.evidence = evidence.value.trim(); });
      card.append(textLabel, text, fields, evidenceLabel, evidence);
      host.append(card);
    });
  }

  function checkEligibility() {
    if (!extractedRequirements.length) return { ok: false, issues: ["Extract and review requirements from the pasted job description first."] };
    const issues = [];
    extractedRequirements.forEach((requirement, index) => {
      if (!requirement.text.trim()) issues.push(`Requirement ${index + 1} is empty; edit it or remove it.`);
      if (requirement.classification === "review") issues.push(`Requirement ${index + 1} has an ambiguous classification. Mark it mandatory or preferred.`);
      if (requirement.classification === "mandatory" && requirement.status !== "PASS") issues.push(`Mandatory requirement ${index + 1}: ${requirement.status}. ${requirement.text}`);
      if (requirement.classification === "mandatory" && requirement.status === "PASS" && !String(requirement.evidence || "").trim()) issues.push(`Mandatory requirement ${index + 1} is marked PASS but has no evidence note.`);
    });
    return { ok: issues.length === 0, issues };
  }

  function showEligibilityResult(result) {
    const box = $("#cv-assessment");
    box.hidden = false;
    box.replaceChildren();
    box.dataset.level = result.ok ? "good" : "poor";
    const heading = document.createElement("strong");
    heading.textContent = result.ok ? "Mandatory requirements verified" : "CV generation blocked";
    box.append(heading);
    const list = document.createElement("ul");
    const messages = result.ok ? ["Every mandatory requirement is marked PASS and has an evidence note. Review the CV for accuracy before use."] : result.issues;
    messages.forEach((message) => { const li = document.createElement("li"); li.textContent = message; list.append(li); });
    box.append(list);
  }

  function setupCV() {
    const roleInput = $("#cv-role");
    const generateButton = $("#generate-cv");
    const preview = $("#cv-preview");
    const printButton = $("#print-cv");
    const closeButton = $("#close-cv");
    const statusBox = $("#job-scout-status");
    const resultsHost = $("#job-scout-results");
    let currentJobs = [];
    let searchSequence = 0;

    const setStatus = (message, level = "info") => {
      if (!statusBox) return;
      statusBox.hidden = false;
      statusBox.dataset.level = level;
      statusBox.textContent = message;
      announce(message);
    };


    // A live vacancy is useful for tailoring, but it must not be a prerequisite
    // for generating a role-focused CV. If feeds are unavailable or no vacancy
    // clears the job-match gate, build the CV from verified profile data instead.
    const generateFromRole = (role) => {
      renderCV(role, "quick", { skipAI: true, silentAssessment: true });
      const assessment = $("#cv-assessment");
      if (assessment) { assessment.hidden = true; assessment.replaceChildren(); }
      if (statusBox) { statusBox.hidden = true; statusBox.textContent = ""; }
      if (resultsHost) { resultsHost.hidden = true; resultsHost.replaceChildren(); }
      if (preview) preview.hidden = false;
      if (printButton) printButton.disabled = false;
      if (closeButton) closeButton.hidden = false;
      announce("Your role-tailored CV is ready. Only verified profile information was used.");
      preview?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const cleanText = (value) => {
      if (!value) return "";
      let text = String(value);
      // Some feeds return HTML that has been HTML-escaped one or more times.
      for (let pass = 0; pass < 2; pass++) {
        const doc = new DOMParser().parseFromString(text, "text/html");
        const next = (doc.body.textContent || "").replace(/\s+/g, " ").trim();
        if (next === text) break;
        text = next;
      }
      return text.replace(/<\/?(?:p|div|span|br|li|ul|strong|em|b|i)\b[^>]*>/gi, " ")
        .replace(/&nbsp;|\u00a0/gi, " ").replace(/\s+/g, " ").trim();
    };

    const normalizeJob = (job, source) => ({
      id: String(job.slug || job.id || job.url || `${job.title}-${job.company_name || job.company || ""}`),
      title: String(job.title || job.position || "Untitled role").trim(),
      company: String(job.company_name || job.company || job.organization || "Company not specified").trim(),
      location: String(job.location || (job.remote ? "Remote" : "Location not specified")).trim(),
      url: safeUrl(job.url || job.apply_url || job.job_url || ""),
      description: cleanText(job.description || job.summary || job.content || ""),
      tags: Array.isArray(job.tags) ? job.tags.map(String) : Array.isArray(job.skills) ? job.skills.map(String) : [],
      source,
      remote: Boolean(job.remote),
    });

    async function fetchJobFeeds(query) {
      const errors = [];
      const feeds = [];
      // Arbeitnow provides a public job-board API; the browser may be blocked by CORS/network policy.
      try {
        const response = await fetch("https://www.arbeitnow.com/api/job-board-api", { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`Arbeitnow returned ${response.status}`);
        const data = await response.json();
        const jobs = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        feeds.push(...jobs.map((job) => normalizeJob(job, "Arbeitnow")));
      } catch (error) { errors.push(`Arbeitnow: ${error.message}`); }

      // RemoteOK is an additional public feed; failure of one feed does not cancel the other.
      try {
        const response = await fetch("https://remoteok.com/api", { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`RemoteOK returned ${response.status}`);
        const data = await response.json();
        const jobs = Array.isArray(data) ? data.filter((item) => item && item.position) : [];
        feeds.push(...jobs.map((job) => normalizeJob({
          title: job.position, company: job.company, location: job.location || (job.remote ? "Remote" : "Remote / not specified"),
          url: job.url, description: job.description, tags: job.tags, id: job.id, remote: true,
        }, "RemoteOK")));
      } catch (error) { errors.push(`RemoteOK: ${error.message}`); }

      const terms = query.toLowerCase().split(/[^a-z0-9+#.]+/).filter((term) => term.length > 2);
      const filtered = feeds.filter((job) => {
        const text = `${job.title} ${job.company} ${job.location} ${job.tags.join(" ")} ${job.description}`.toLowerCase();
        return terms.some((term) => text.includes(term));
      });
      const unique = new Map();
      filtered.forEach((job) => {
        const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}|${job.url}`;
        if (!unique.has(key)) unique.set(key, job);
      });
      return { jobs: [...unique.values()].slice(0, 20), errors };
    }

    function profileEvidenceText() {
      return [
        currentProfile.name, currentProfile.title, currentProfile["about-me"], currentProfile["short-description"],
        ...education.flatMap((item) => [item.degree, item["field-of-study"], item.stream, item.college, item.university, item.duration]),
        ...Object.entries(skills).flatMap(([category, items]) => [category, ...(Array.isArray(items) ? items : [])]),
        ...projects.flatMap((item) => [item.name, item.description, ...(item.technologies || [])]),
        ...experience.flatMap((item) => [item.position, item.company, item.description]),
        ...achievements.flatMap((item) => typeof item === "string" ? [item] : [item.title, item.name, item.achievement, item.description, item.organization]),
        ...memberships.flatMap((item) => typeof item === "string" ? [item] : [item.name, item.organization]),
        ...languages,
        ...(Array.isArray(info?.CURRENT_FOCUS) ? info.CURRENT_FOCUS : []),
      ].filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9+#.]+/g, " ");
    }

    const REQUIREMENT_SKIP = new Set([
      "the", "and", "with", "for", "from", "that", "this", "will", "are", "you", "your", "our", "have", "has", "into", "using", "use", "ability", "strong", "good", "excellent", "work", "working", "knowledge", "experience", "skills", "skill", "years", "year", "including", "required", "requirements", "preferred", "plus", "must", "should", "able", "such", "other", "role", "team", "teams", "responsibilities", "qualification", "qualifications", "who", "what", "their", "they", "minimum", "ideal", "candidate", "candidates", "applicant", "applicants", "proven", "demonstrated", "familiarity", "understanding", "proficiency", "proficient", "including", "related", "field", "degree", "bachelor", "bachelors", "master", "masters", "or", "an", "a", "in", "to", "of", "be", "as", "at", "on", "by", "is", "it", "can", "etc"
    ]);

    const MATCH_THRESHOLD = 75;
    const MATCH_STOPWORDS = new Set([...REQUIREMENT_SKIP, "engineer", "engineering", "developer", "development", "system", "systems", "job", "role", "company", "work", "working", "based", "including", "across", "within", "team", "teams"]);

    function calculateMatchScore(job, role) {
      const profile = profileEvidenceText();
      const roleTerms = String(role || "").toLowerCase().split(/[^a-z0-9+#.]+/).filter((term) => term.length > 2 && !MATCH_STOPWORDS.has(term));
      const jobText = `${job.title} ${job.tags.join(" ")} ${job.description}`.toLowerCase();
      const profileTerms = [...new Set(profile.split(/[^a-z0-9+#.]+/).filter((term) => term.length > 2 && !MATCH_STOPWORDS.has(term)))];
      const relevantTerms = [...new Set([...roleTerms, ...profileTerms.filter((term) => jobText.includes(term))])];
      if (!relevantTerms.length) return { score: 0, matched: [], missing: [] };
      const matched = relevantTerms.filter((term) => jobText.includes(term) && profile.includes(term));
      const missing = relevantTerms.filter((term) => !matched.includes(term));
      // Role intent carries extra weight; the remaining score measures overlap between job details and verified profile evidence.
      const roleMatched = roleTerms.filter((term) => jobText.includes(term) && profile.includes(term));
      const roleCoverage = roleTerms.length ? roleMatched.length / roleTerms.length : 0;
      const profileCoverage = relevantTerms.length ? matched.length / relevantTerms.length : 0;
      const score = Math.round(Math.min(100, (roleCoverage * 0.55 + profileCoverage * 0.45) * 100));
      return { score, matched: [...new Set([...roleMatched, ...matched])].slice(0, 10), missing: [...new Set(missing)].slice(0, 8) };
    }

    function checkJobMatch(job) {
      const profileText = profileEvidenceText();
      const description = job.description;
      if (!description || description.length < 80) {
        return { status: "unknown", title: "Cannot verify requirements", reasons: ["The feed did not provide enough job-description detail to assess mandatory requirements. CV generation is blocked."] };
      }
      const sentences = description
        .replace(/([.!?])\s+/g, "$1\n")
        .split(/[\n•●▪◦]+/)
        .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
        .filter((line) => line.length >= 15 && line.length <= 420);
      const mandatoryPattern = /\b(required|required to|must have|must be|must possess|mandatory|essential|minimum qualification|minimum of|at least \d+ years|need to have|requirement is|you will need|eligible candidates must)\b/i;
      const mandatory = [...new Set(sentences.filter((line) => mandatoryPattern.test(line)))];
      if (!mandatory.length) {
        return { status: "pass", title: "No explicit mandatory requirement could be isolated", reasons: ["The listing did not expose clearly phrased mandatory requirements. The compatibility threshold is still applied, but this is not proof of employer eligibility; review the original listing before applying."] };
      }
      const results = mandatory.map((line, index) => {
        const tokens = [...new Set(line.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").split(/\s+/).filter((token) => token.length > 2 && !REQUIREMENT_SKIP.has(token)))];
        const meaningful = tokens.filter((token) => !/^\d+$/.test(token));
        const missing = meaningful.filter((token) => !profileText.includes(token));
        // Conservative gate: a mandatory statement is supported only when all extracted key terms are documented.
        const pass = meaningful.length > 0 && missing.length === 0;
        return { line, pass, missing, index };
      });
      const failures = results.filter((result) => !result.pass);
      if (failures.length) {
        const unknownOnly = failures.every((item) => item.missing.length === 0);
        return {
          status: unknownOnly ? "unknown" : "fail",
          title: unknownOnly ? "Requirements need review" : "Mandatory requirements not fully evidenced",
          reasons: failures.slice(0, 6).map((item) => item.missing.length
            ? `Not found in the current profile: ${item.missing.slice(0, 8).join(", ")}. Requirement: ${item.line}`
            : `Could not reliably verify this requirement: ${item.line}`),
          passed: results.length - failures.length,
          total: results.length,
        };
      }
      return {
        status: "pass", title: "Mandatory requirements matched against profile evidence",
        reasons: [`All ${results.length} detected mandatory requirement statement(s) have their extracted key terms represented in the current profile.`, "This is a conservative keyword-based screening, not a guarantee of employer eligibility. Review the generated CV for accuracy."],
        passed: results.length, total: results.length,
      };
    }

    function renderJobCards(jobs, role, evaluations = new Map()) {
      resultsHost.replaceChildren();
      jobs.forEach((job) => {
        const evaluation = evaluations.get(job.id) || { score: 0, status: "unknown", reasons: [] };
        const card = document.createElement("article");
        card.className = "job-card";
        const title = document.createElement("h3"); title.textContent = job.title;
        const company = document.createElement("p"); company.className = "job-meta"; company.textContent = `${job.company} · ${job.location} · ${job.source}`;
        const score = document.createElement("p"); score.className = "job-score";
        score.textContent = `Profile match: ${evaluation.score}%${evaluation.score >= MATCH_THRESHOLD ? " · Meets 75% threshold" : " · Below 75% threshold"}`;
        score.dataset.level = evaluation.score >= MATCH_THRESHOLD ? "good" : "poor";
        const excerpt = document.createElement("p");
        excerpt.textContent = job.description ? `${job.description.slice(0, 280)}${job.description.length > 280 ? "…" : ""}` : "This feed did not include a detailed description.";
        const actions = document.createElement("div"); actions.className = "job-actions";
        if (job.url) {
          const link = document.createElement("a"); link.className = "button button-quiet"; link.href = job.url; link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "View listing ↗"; actions.append(link);
        }
        const resultBox = document.createElement("div"); resultBox.className = "job-match-result";
        resultBox.dataset.result = evaluation.status;
        const heading = document.createElement("strong");
        heading.textContent = evaluation.status === "pass" ? "Eligible for automatic CV generation" : evaluation.status === "fail" ? "Mandatory requirement mismatch" : "Requirements not fully verifiable";
        resultBox.append(heading);
        if (evaluation.reasons?.length) {
          const list = document.createElement("ul");
          evaluation.reasons.slice(0, 3).forEach((reason) => { const li = document.createElement("li"); li.textContent = reason; list.append(li); });
          resultBox.append(list);
        }
        card.append(title, company, score, excerpt, actions, resultBox);
        resultsHost.append(card);
      });
    }

    generateButton?.addEventListener("click", async () => {
      const query = roleInput?.value.trim();
      if (!query) {
        setStatus("Enter your target job role first so the job feeds can search for relevant listings.", "warning");
        roleInput?.focus();
        return;
      }
      const sequence = ++searchSequence;
      generateButton.disabled = true;
      generateButton.textContent = "Searching jobs & matching profile…";
      resultsHost.replaceChildren();
      preview.hidden = true;
      printButton.disabled = true;
      closeButton.hidden = true;
      setStatus("Searching public job feeds and scoring listings against your verified profile. Automatic CV generation requires at least 75% compatibility and no detected mandatory-requirement failure.");
      try {
        const result = await fetchJobFeeds(query);
        if (sequence !== searchSequence) return;
        currentJobs = result.jobs;
        if (!result.jobs.length) {
          // Job feeds can be empty, unavailable, or unable to cover niche roles.
          // Still generate a profile-grounded CV for the user's requested role.
          generateFromRole(query);
          return;
        }

        const evaluations = new Map();
        for (const job of result.jobs) {
          const match = calculateMatchScore(job, query);
          const requirements = checkJobMatch(job);
          const eligible = match.score >= MATCH_THRESHOLD && requirements.status !== "fail" && requirements.status !== "unknown";
          evaluations.set(job.id, {
            ...match,
            status: eligible ? "pass" : requirements.status === "fail" ? "fail" : "unknown",
            reasons: [
              `Compatibility score: ${match.score}% (minimum ${MATCH_THRESHOLD}%).`,
              ...(requirements.reasons || []),
              ...(match.missing.length ? [`Some relevant terms were not found in both the listing and profile: ${match.missing.join(", ")}.`] : []),
            ],
          });
        }
        const eligibleJobs = result.jobs
          .map((job, index) => ({ job, index, evaluation: evaluations.get(job.id) }))
          .filter((item) => item.evaluation.status === "pass" && item.evaluation.score >= MATCH_THRESHOLD)
          .sort((a, b) => b.evaluation.score - a.evaluation.score || a.index - b.index);
        // Job discovery and scoring stay internal: the public interface focuses on the CV.
        resultsHost?.replaceChildren();
        if (resultsHost) resultsHost.hidden = true;
        const sourceNames = [...new Set(result.jobs.map((job) => job.source))].join(" and ");
        if (eligibleJobs.length) {
          const best = eligibleJobs[0];
          roleInput.value = query;
          generateFromRole(query);
        } else {
          // Keep the 75% vacancy threshold for job matching, but do not block
          // the CV itself: tailor it from verified profile skills/projects.
          generateFromRole(query);
        }
      } catch (error) {
        if (sequence !== searchSequence) return;
        // A feed/network error should not prevent generating a CV from the profile.
        generateFromRole(query);
      } finally {
        if (sequence === searchSequence) {
          generateButton.disabled = false;
          generateButton.textContent = "Generate My CV";
        }
      }
    });

    roleInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); generateButton?.click(); }
    });
    // Fit the complete CV into one printable A4 page, scaling down only when needed.
    const fitCVForPrint = () => {
      const sheet = preview?.querySelector(".cv-sheet");
      if (!sheet || preview.hidden) return;
      sheet.style.setProperty("--cv-print-scale", "1");
      const availableHeight = sheet.clientHeight || sheet.getBoundingClientRect().height;
      const contentHeight = sheet.scrollHeight;
      const scale = contentHeight > availableHeight && availableHeight > 0
        ? Math.max(0.55, availableHeight / contentHeight)
        : 1;
      sheet.style.setProperty("--cv-print-scale", String(scale));
    };
    window.addEventListener("beforeprint", fitCVForPrint);
    window.addEventListener("afterprint", () => {
      const sheet = preview?.querySelector(".cv-sheet");
      sheet?.style.removeProperty("--cv-print-scale");
    });
    printButton?.addEventListener("click", () => {
      if (!preview.hidden) { fitCVForPrint(); window.print(); }
    });
    closeButton?.addEventListener("click", () => {
      preview.hidden = true; printButton.disabled = true; closeButton.hidden = true;
      document.body.classList.remove("no-scroll");
      document.documentElement.style.removeProperty("overflow");
      document.body.style.removeProperty("overflow");
    });
  }

  function startParticles() {
    const canvas = $("#particleAccelerator");
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || settings?.ANIMATIONS?.enabled === false || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const count = Math.min(55, settings?.PARTICLES?.count || 35);
    const particles = [];
    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    resize();
    for (let i = 0; i < count; i++) particles.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25 });
    const draw = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > innerWidth) p.vx *= -1;
        if (p.y < 0 || p.y > innerHeight) p.vy *= -1;
        ctx.fillStyle = "rgba(54,214,208,.65)";
        ctx.fillRect(p.x, p.y, 2, 2);
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const distance = Math.hypot(p.x - q.x, p.y - q.y);
          if (distance < 105) {
            ctx.strokeStyle = `rgba(54,214,208,${(1 - distance / 105) * 0.12})`;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
      window.requestAnimationFrame(draw);
    };
    window.addEventListener("resize", resize);
    draw();
  }

  async function main() {
    setupTheme();
    setupNavigation();
    setupCV();
    try {
      const [rawInfo, rawSettings] = await Promise.all([fetchJSON("assets/info.json"), fetchJSON("assets/settings.json")]);
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
      if (summary) summary.textContent = "Portfolio data could not be loaded. Serve this site over HTTP and check assets/info.json and assets/settings.json.";
      announce("Portfolio data failed to load.");
    } finally {
      window.setTimeout(hideLoadingScreen, settings?.LOADING_SCREEN?.durationMs || 500);
    }
  }

  const projectDialog = $("#project-dialog");
  const closeProjectDialog = () => {
    if (projectDialog?.open && typeof projectDialog.close === "function") projectDialog.close();
    else projectDialog?.removeAttribute("open");
    // Defensive cleanup: no modal or preview may leave the document scroll-locked.
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
  document.addEventListener("DOMContentLoaded", main);
})();
