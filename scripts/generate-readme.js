import { Octokit } from "@octokit/rest"
import fs from "fs"

const token = process.env.GITHUB_TOKEN
const username = process.env.GITHUB_USERNAME

const octokit = new Octokit({ auth: token })

const repos = await octokit.paginate(
  octokit.repos.listForUser,
  { username, per_page: 100 }
)

const now = new Date()

function daysSince(date) {
  return (now - new Date(date)) / (1000 * 60 * 60 * 24)
}

function scoreRepo(repo) {
  let score = 0

  const days = daysSince(repo.pushed_at)

  if (days <= 30) score += 40
  else if (days <= 90) score += 20
  else if (days <= 180) score += 10

  score += Math.min(repo.stargazers_count * 2, 40)

  if (repo.open_issues_count === 0) score += 20
  else if (repo.open_issues_count <= 5) score += 10

  if (repo.homepage) score += 20

  if (
    repo.description &&
    ["live", "production", "app"].some(word =>
      repo.description.toLowerCase().includes(word)
    )
  ) {
    score += 10
  }

  if (repo.size > 5000) score += 20
  else if (repo.size > 1000) score += 10

  return score
}

const filtered = repos.filter(r => !r.fork)

const scored = filtered.map(repo => ({
  ...repo,
  portfolioScore: scoreRepo(repo)
}))

scored.sort((a, b) => b.portfolioScore - a.portfolioScore)

const topProjects = scored.slice(0, 5)

const production = scored.filter(r => r.homepage)

const active = scored.filter(r => daysSince(r.pushed_at) <= 30)

const archived = scored.filter(r => daysSince(r.pushed_at) > 180)

const languageStats = {}

filtered.forEach(repo => {
  if (repo.language) {
    languageStats[repo.language] =
      (languageStats[repo.language] || 0) + 1
  }
})

const sortedLanguages = Object.entries(languageStats)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)

const readme = `
# ${username} Portfolio Intelligence

## 📊 Portfolio Overview
- Total Repositories: ${filtered.length}
- Active Systems: ${active.length}
- Production Systems: ${production.length}
- Archived Systems: ${archived.length}

---

## 🏆 Top Ranked Projects

${topProjects.map(r =>
`### ${r.name}
Score: ${r.portfolioScore}
Stars: ${r.stargazers_count}
Last Push: ${r.pushed_at}
[View Repo](${r.html_url})
`).join("\n")}

---

## 🚀 Production Systems

${production.slice(0, 5).map(r =>
`- [${r.name}](${r.homepage})`
).join("\n") || "None"}

---

## 🔥 Active Systems

${active.slice(0, 5).map(r =>
`- [${r.name}](${r.html_url})`
).join("\n") || "None"}

---

## 🧠 Stack Dominance

${sortedLanguages.map(([lang, count]) =>
`- ${lang}: ${count} repos`
).join("\n")}

---

Auto updated daily via GitHub Actions
`

fs.writeFileSync("README.md", readme)
