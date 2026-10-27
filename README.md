# Srijan Bhattacharyya — Robotics & Embedded Systems Portfolio

A responsive personal portfolio focused on embedded systems, robotics, software development, and engineering projects. Built with vanilla HTML, CSS, and JavaScript, the website keeps profile information in JSON files so that most content updates can be made without modifying the interface code.

**Live Website:** [srijan.76448.org](https://srijan.76448.org)

---

## Features

- **Responsive Design:** Layout adapted for desktop and mobile screens.
- **Theme Switching:** Dark and light theme support.
- **Data-Driven Portfolio:** Profile, education, skills, projects, memberships, languages, and contact information are managed through JSON data.
- **Role-Tailored CV Generator:** Generates a CV based on the job title entered by the user.
- **Automatic Job Discovery:** Searches supported public job feeds without requiring users to paste a job description or manually select a listing.
- **Job Compatibility Assessment:** Uses a configurable rule-based approach with a 75% minimum compatibility threshold for automatic job-based CV selection.
- **Relevant Skills and Projects:** Prioritizes documented skills and projects based on their relevance to the target role, applying a 75% minimum relevance threshold.
- **Profile-Based Fallback:** Can generate a role-oriented CV from existing profile information when no suitable job listing is available.
- **Single-Page A4 CV:** CV preview and browser print-to-PDF workflow designed for one A4 portrait page.
- **Clickable Social Handles:** Displays social platform names and user IDs, with each user ID linked to the corresponding profile URL.
- **Contact Integration:** Supports contact actions such as opening an email draft in the visitor's configured email application.
- **Reduced-Motion Support:** Animation behavior can respect the visitor's motion preferences.
- **Lightweight Architecture:** Uses standard HTML, CSS, and JavaScript without requiring a frontend framework or build process.

> **Important:** Job compatibility and skill/project relevance scores are heuristic estimates, not statistically validated probabilities of employment. Always review the generated CV before using it. The system must not invent qualifications, skills, projects, experience, dates, or achievements.

---

## Technology Stack

- **HTML5** — Page structure and content.
- **CSS3** — Responsive layouts, themes, styling, and print presentation.
- **Vanilla JavaScript** — Portfolio rendering, interactions, job matching, and CV generation.
- **JSON** — Profile content, social links, and site settings.
- **Public Job Feeds** — External sources for discovering job listings, subject to availability and browser restrictions.
- **Browser Print API** — Previewing and exporting the CV to PDF.

---

## Project Structure

The main files are organized as follows:

```text
Resume/
├── index.html
├── index.css
├── index.js
├── README.md
└── assets/
    ├── info.json
    ├── settings.json
    └── imgs/
        ├── logo
            ├── v1.webp
            └── v2.webp
        └── pfp.jpg
```

This is a representative structure. Keep the filenames and asset paths consistent with the actual files in your repository. Additional assets, such as a favicon or alternative logo formats, can be included as required by the implementation.

---

## Configuration and Portfolio Data

### `assets/info.json`

This file contains the portfolio's editable information. Depending on the schema used by the deployed version, it may include:

- `PROFILE` — Name, professional title, biography, and short description.
- `EDUCATION` — Degrees, institutions, durations, and academic details.
- `SKILLS` — Skill categories and individual skills.
- `PROJECTS` — Project names, descriptions, technologies, and links.
- `EXPERIENCE` — Documented work experience or internships, if included in the schema.
- `MEMBERSHIPS` — Organizations and communities.
- `LANGUAGES` — Spoken or written languages.
- `CONTACT` or `socials` — Contact details and social profile information.

The JavaScript may support an older data schema for backward compatibility. Follow the structure already used in your current `info.json` file rather than mixing incompatible schema versions.

### Social Profile Configuration

Social profiles can be represented using the following structure:

```json
{
  "socials": {
    "github": {
      "url": "https://github.com/srijan-76448",
      "user-id": "srijan-76448",
      "icon": "github"
    },
    "linkedin": {
      "url": "https://www.linkedin.com/in/srijan76448/",
      "user-id": "srijan76448",
      "icon": "linkedin"
    },
    "medium": {
      "url": "https://medium.com/@srijan-76448",
      "user-id": "srijan-76448",
      "icon": "medium"
    },
    "instagram": {
      "url": "https://www.instagram.com/srijan.76448",
      "user-id": "srijan.76448",
      "icon": "instagram"
    },
    "facebook": {
      "url": "https://www.facebook.com/srijan.76448",
      "user-id": "srijan.76448",
      "icon": "facebook"
    },
    "x": {
      "url": "https://x.com/srijan76448",
      "user-id": "srijan76448",
      "icon": "x"
    }
  }
}
```

The fields have the following purposes:

- `url` — Destination URL of the social profile.
- `user-id` — Visible account identifier.
- `icon` — Identifier for the corresponding platform icon.

In the generated CV, the social links should use a readable format such as:

```text
github: srijan-76448 · linkedin: srijan76448 ·
medium: srijan-76448
```

Each displayed user ID should be hyperlinked to its corresponding `url`. Update the JSON data whenever a social profile changes.

---

## Role-Tailored CV Generator

The CV generator is designed to create a role-oriented CV using the target job title entered by the user and the information already available in the portfolio.

### Workflow

1. Enter a target job title, such as **Embedded Systems and Robotics Engineer**.
2. The system searches supported public job feeds for relevant listings.
3. Available listings are evaluated against the verified profile.
4. The system selects the best eligible listing when a suitable match is found.
5. Skills and projects are prioritized according to their relevance to the target role.
6. The CV is generated using documented profile information.
7. The user can preview the CV and print or save it as a PDF.

### Job Compatibility Threshold

The automatic job-based selection uses a minimum compatibility threshold of **75%**.

The compatibility score is a rule-based estimate. It should not be interpreted as proof that an employer will accept an application or that the candidate meets every qualification.

If no suitable listing is available, the generator can fall back to the target role and the existing profile data rather than refusing to generate a CV solely because a job feed has no qualifying result.

### Skills and Project Relevance

The generator prioritizes existing skills and projects according to their relevance to the target role.

- Items meeting the **75% minimum relevance threshold** can be selected for the tailored CV.
- Items below the threshold should be excluded from the tailored selection.
- Relevant documented information should take priority over unrelated material.
- The generator must not invent skills, projects, technologies, qualifications, experience, or project outcomes.
- Missing information should remain missing rather than being guessed.

For example, an embedded systems role should prioritize relevant documented embedded programming, firmware, electronics, or microcontroller experience when those items are actually present in the profile.

A robotics role should prioritize documented robotics, sensing, control, autonomous systems, and related projects when supported by the profile data.

These examples describe selection principles, not claims that every listed skill is present in the candidate's profile.

### Single-Page A4 Output

The generated CV is intended to fit on exactly one **A4 portrait page**, measuring **210 × 297 mm**.

The print layout should:

- Specify A4 portrait paper.
- Keep the CV within a single page.
- Use compact but readable typography and spacing.
- Prioritize the most relevant skills, projects, and profile information.
- Avoid spilling content onto a second page.

Browser print settings, fonts, and PDF drivers can affect the final output. Review the print preview before saving the PDF. If the content is too dense, shorten descriptions and remove lower-priority information rather than shrinking the text excessively.

### Review Before Use

The CV generator is a drafting aid. Before submitting a generated CV:

- Verify contact details and social links.
- Check education, dates, and qualifications.
- Confirm that each selected skill reflects actual knowledge or experience.
- Review project descriptions and technology claims.
- Remove any content that is inaccurate or misleading.

---

## Site Settings

### `assets/settings.json`

This file manages supported site settings, which may include:

- Theme and appearance.
- Navigation behavior.
- Animation settings.
- Branding and presentation options.
- Optional data-related features.

The available keys depend on the settings schema used by the current implementation.

When modifying settings, update only the required values and preserve unrelated existing configuration.

---

## Local Development

The static portfolio does not require a frontend package installation or build step.

### Setup

1. Clone or download the repository.
2. Open the project directory.
3. Update `assets/info.json` and `assets/settings.json` as needed.
4. Start a local static HTTP server.

For example, if Python is installed:

```bash
python -m http.server 8000
```

5. Open the following URL in your browser:

```text
http://localhost:8000
```

Using an HTTP server is recommended because browser security restrictions can prevent JavaScript from loading local JSON files when the page is opened directly using a `file://` URL.

---

## Troubleshooting

### Portfolio information does not load

- Confirm that the JSON files exist at the paths referenced by `index.js`.
- Validate the JSON syntax.
- Serve the project through a local HTTP server.
- Check the browser console for failed requests or JavaScript errors.

### No matching job listings appear

- Public job feeds may be unavailable or may change their response formats.
- Browser CORS restrictions can prevent a frontend request from succeeding.
- Check the browser console and network panel for failed requests.
- The profile-based CV fallback should remain available when job discovery fails, provided the generator's fallback logic is working.

### The CV is not tailored correctly

- Check that `assets/info.json` contains accurate, sufficiently detailed skill and project descriptions.
- Include relevant technologies and responsibilities where they are factually supported.
- Confirm that the matching logic is using the current data schema.
- Remember that a relevance score cannot compensate for information missing from the profile.

### The CV exceeds one page

- Review the browser's print preview.
- Select A4 paper and portrait orientation.
- Check print scaling and margins.
- Reduce low-priority content and shorten descriptions.
- Confirm that the latest print CSS and JavaScript are deployed.

### Social links are incorrect

- Verify both the `url` and `user-id` values in the social profile configuration.
- Ensure that the visible account identifier links to the correct profile URL.

### Website changes do not appear

- Confirm that the latest files were committed and deployed.
- Hard-refresh the browser to bypass cached assets.
- Check whether the hosting provider or CDN is serving an older version.

---

## Accessibility and Security

- Prefer semantic HTML and keyboard-operable controls.
- Respect reduced-motion preferences.
- Optimize images and provide meaningful alternative text.
- Never expose API tokens or private credentials in browser-delivered JavaScript or JSON.
- Treat external job descriptions as untrusted content and sanitize markup before displaying it.
- Keep any feature requiring secrets or privileged API access in a trusted server-side environment or CI workflow.

The portfolio is designed to be static-first, with no required frontend build system.

---

## License

No license is specified by this README. Add a `LICENSE` file if you intend to grant explicit permission for reuse, modification, or redistribution.

---

## Author

**Srijan Bhattacharyya**
