# AIM Website

Official website of the AIM Initiative, built with Astro.

---

# Prerequisites

Before working on this project, please install the following software:

## 1. Git

Git is required for version control and to clone the repository.

Download:
https://git-scm.com/downloads

Verify the installation:

```bash
git --version
```

---

## 2. Node.js (LTS Version)

Astro requires Node.js and npm.

Download:
https://nodejs.org/

After installation, verify:

```bash
node -v
npm -v
```

---

## 3. Visual Studio Code (Recommended)

Recommended editor for development.

Download:
https://code.visualstudio.com/

Recommended extensions:

* Astro
* ESLint
* Prettier
* GitHub Pull Requests and Issues (optional)
* Claude Code (optional)

---

# Clone the Repository

Clone the repository to your local machine:

```bash
git clone <REPOSITORY_URL>
```

Navigate into the project folder:

```bash
cd <PROJECT_FOLDER>
```

---

# Install Dependencies

Install all required packages:

```bash
npm install
```

This will automatically install all dependencies defined in `package.json`.

---

# Start the Development Server

Run:

```bash
npm run dev
```

The website will then be available locally at:

```
http://localhost:4321
```

This local development server is **only accessible on your own computer** and is **not publicly available online**.

---

# Building for Production

To create a production build:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

# Project Structure

```
src/
│
├── assets/
├── components/
├── layouts/
├── pages/
└── styles/

public/

package.json
astro.config.mjs
```

---

# Working with Git

Check the current status:

```bash
git status
```

Create a commit:

```bash
git add .
git commit -m "Describe your changes"
```

Push your changes:

```bash
git push
```

Pull the latest changes before starting new work:

```bash
git pull
```

---

# Installing New Packages

If additional packages are required:

```bash
npm install <package-name>
```

After pulling changes from GitHub that include new dependencies, simply run:

```bash
npm install
```

---

# Development Workflow

Recommended workflow:

1. Pull the latest changes
2. Create or edit your feature
3. Test locally using `npm run dev`
4. Commit your changes
5. Push to GitHub

---

# Useful Resources

Astro Documentation:
https://docs.astro.build/

Astro Integrations:
https://astro.build/integrations/

Git Documentation:
https://git-scm.com/doc

Node.js Documentation:
https://nodejs.org/docs/latest/api/

---

# Maintainers

AIM Initiative Website Team
