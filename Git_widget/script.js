const GITHUB_USERNAME = ""; // ⚠️ GitHub username
const GITHUB_TOKEN = ""; // ⚠️ GitHub Personal Access Token

// === THEME TOGGLE ===
function toggleTheme() {
  const body = document.body;
  const themeIcon = document.getElementById("theme-icon");
  const themeText = document.getElementById("theme-text");

  if (body.hasAttribute("data-theme")) {
    body.removeAttribute("data-theme");
    themeIcon.textContent = "🌙";
    themeText.textContent = "Dark Mode";
    localStorage.setItem("theme", "dark");
  } else {
    body.setAttribute("data-theme", "light");
    themeIcon.textContent = "☀️";
    themeText.textContent = "Light Mode";
    localStorage.setItem("theme", "light");
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.body.setAttribute("data-theme", "light");
    document.getElementById("theme-icon").textContent = "☀️";
    document.getElementById("theme-text").textContent = "Light Mode";
  }
}

// === FETCH REAL GITHUB DATA ===
async function fetchGitHubContributions() {
  const query = `
    query {
      user(login: "${GITHUB_USERNAME}") {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
    },
    body: JSON.stringify({ query }),
  });

  const result = await response.json();

  if (!result.data) throw new Error("Invalid response from GitHub");

  const weeks =
    result.data.user.contributionsCollection.contributionCalendar.weeks;
  const days = weeks.flatMap((week) =>
    week.contributionDays.map((day) => ({
      date: new Date(day.date),
      count: day.contributionCount,
      level:
        day.contributionCount === 0
          ? 0
          : Math.min(Math.floor(day.contributionCount / 3) + 1, 4),
    }))
  );

  return days;
}

// === HEATMAP ===
function renderHeatmap(contributions) {
  const monthLabels = document.getElementById("monthLabels");
  const heatmapGrid = document.getElementById("heatmapGrid");
  monthLabels.innerHTML = "";
  heatmapGrid.innerHTML = "";

  const weeks = [];
  let currentWeek = [];

  const firstDay = contributions[0].date;
  const firstDayOfWeek = firstDay.getDay();

  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push(null);
  }

  contributions.forEach((contrib) => {
    currentWeek.push(contrib);
    if (currentWeek.length === 7) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  });

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  let lastMonth = -1;
  weeks.forEach((week, weekIndex) => {
    const firstValidDay = week.find((day) => day !== null);
    if (firstValidDay) {
      const month = firstValidDay.date.getMonth();
      if (month !== lastMonth && weekIndex > 0) {
        const label = document.createElement("div");
        label.className = "month-label";
        label.textContent = firstValidDay.date.toLocaleDateString("en", {
          month: "short",
        });
        label.style.gridColumnStart = weekIndex + 1;
        monthLabels.appendChild(label);
        lastMonth = month;
      }
    }
  });

  weeks.forEach((week) => {
    const weekColumn = document.createElement("div");
    weekColumn.className = "week-column";

    week.forEach((day) => {
      const cell = document.createElement("div");
      cell.className = "contribution-cell";

      if (day) {
        cell.classList.add(`level-${day.level}`);
        cell.setAttribute("data-date", day.date.toISOString().split("T")[0]);
        cell.setAttribute("data-count", day.count);
        cell.addEventListener("mouseenter", showTooltip);
        cell.addEventListener("mouseleave", hideTooltip);
      } else {
        cell.style.visibility = "hidden";
      }

      weekColumn.appendChild(cell);
    });

    heatmapGrid.appendChild(weekColumn);
  });
}

// === TOOLTIP ===
function showTooltip(e) {
  const tooltip = document.getElementById("tooltip");
  const date = e.target.getAttribute("data-date");
  const count = e.target.getAttribute("data-count");

  const formattedDate = new Date(date).toLocaleDateString("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  tooltip.innerHTML = `<strong>${count} contributions</strong><br>${formattedDate}`;
  tooltip.style.opacity = "1";
  const rect = e.target.getBoundingClientRect();
  tooltip.style.left = rect.left + rect.width / 2 + "px";
  tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + "px";
}

function hideTooltip() {
  document.getElementById("tooltip").style.opacity = "0";
}

// === STATS ===
function calculateStats(contributions) {
  const total = contributions.reduce((sum, day) => sum + day.count, 0);

  let currentStreak = 0;
  for (let i = contributions.length - 1; i >= 0; i--) {
    if (contributions[i].count > 0) currentStreak++;
    else break;
  }

  let longestStreak = 0;
  let tempStreak = 0;
  contributions.forEach((day) => {
    if (day.count > 0) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else tempStreak = 0;
  });

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const thisWeek = contributions
    .filter((day) => day.date >= weekStart)
    .reduce((sum, day) => sum + day.count, 0);

  const bestDay = Math.max(...contributions.map((day) => day.count));

  return { total, currentStreak, longestStreak, thisWeek, bestDay };
}

function updateStats(stats) {
  document.getElementById("totalContributions").textContent =
    stats.total.toLocaleString();
  document.getElementById("currentStreak").textContent =
    stats.currentStreak + " days";
  document.getElementById("longestStreak").textContent =
    stats.longestStreak + " days";
  document.getElementById("thisWeek").textContent =
    stats.thisWeek.toLocaleString();
  document.getElementById("bestDay").textContent =
    stats.bestDay.toLocaleString();
}

// === CHART ===
function renderChart(contributions) {
  const ctx = document.getElementById("activityChart").getContext("2d");
  const weeklyData = [];
  const weekLabels = [];

  for (let i = 0; i < contributions.length; i += 7) {
    const week = contributions.slice(i, i + 7);
    const weekTotal = week.reduce((sum, day) => sum + day.count, 0);
    const weekStart = week[0]?.date;

    if (weekStart) {
      weeklyData.push(weekTotal);
      weekLabels.push(
        weekStart.toLocaleDateString("en", { month: "short", day: "numeric" })
      );
    }
  }

  const recentWeeklyData = weeklyData.slice(-26);
  const recentWeekLabels = weekLabels.slice(-26);

  new Chart(ctx, {
    type: "line",
    data: {
      labels: recentWeekLabels,
      datasets: [
        {
          label: "Weekly Contributions",
          data: recentWeeklyData,
          borderColor: "var(--accent-color)",
          backgroundColor: "rgba(35, 134, 54, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "var(--accent-color)",
          pointBorderColor: "var(--accent-color)",
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: "var(--border-color)" },
          ticks: { color: "var(--text-secondary)", maxTicksLimit: 8 },
        },
        y: {
          beginAtZero: true,
          grid: { color: "var(--border-color)" },
          ticks: { color: "var(--text-secondary)" },
        },
      },
    },
  });
}

// === INIT ===
async function initDashboard() {
  try {
    const contributions = await fetchGitHubContributions();
    const stats = calculateStats(contributions);

    document.getElementById("loading").style.display = "none";
    document.getElementById("heatmap-content").style.display = "block";

    renderHeatmap(contributions);
    updateStats(stats);
    renderChart(contributions);
  } catch (err) {
    document.getElementById("loading").innerText =
      "Failed to load contributions.";
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initDashboard();
});
