// Statistics page script

document.addEventListener("DOMContentLoaded", function () {
  const periodButtons = document.querySelectorAll(".period-button");
  const moneySaved = document.getElementById("moneySaved");
  const moneyLost = document.getElementById("moneyLost");
  const netImpact = document.getElementById("netImpact");
  const timeSaved = document.getElementById("timeSaved");
  const timeWasted = document.getElementById("timeWasted");
  const netSubtitle = document.getElementById("netSubtitle");
  const weekChart = document.getElementById("weekChart");
  const insightTitle = document.getElementById("insightTitle");
  const insightText = document.getElementById("insightText");
  const resetButton = document.getElementById("resetButton");

  let currentPeriod = "today";
  let updateInterval = null;

  // Period button handlers
  periodButtons.forEach((button) => {
    button.addEventListener("click", function () {
      periodButtons.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      currentPeriod = this.dataset.period;
      updateStats();
    });
  });

  // Reset button
  resetButton.addEventListener("click", function () {
    if (
      confirm(
        "Are you sure you want to reset all statistics? This cannot be undone."
      )
    ) {
      // Get current data to preserve important settings
      // IMPORTANT: Preserves annualSalary, advanced blocking options, and extension state
      browser.storage.local.get(null).then((allData) => {
        browser.storage.local
          .set({
            ...allData, // Preserve everything (salary, advanced options, etc)
            dailyStats: {},
            weeklyStats: {},
            monthlyStats: {},
            yearlyStats: {},
            allTimeStats: {
              timeSaved: 0,
              timeWasted: 0,
              moneySaved: 0,
              moneyLost: 0,
            },
            totalTimeSaved: 0,
            totalTimeWasted: 0,
            enabledAt: allData.xFeedBlockerEnabled ? Date.now() : null,
            disabledAt: !allData.xFeedBlockerEnabled ? Date.now() : null,
            lastResetDate: new Date().toDateString(),
          })
          .then(() => {
            alert("Statistics reset successfully!");
            updateStats();
          });
      });
    }
  });

  // Update stats every second
  updateInterval = setInterval(updateStats, 1000);
  updateStats();

  function updateStats() {
    browser.storage.local
      .get([
        "annualSalary",
        "dailyStats",
        "weeklyStats",
        "monthlyStats",
        "yearlyStats",
        "allTimeStats",
        "xFeedBlockerEnabled",
        "enabledAt",
        "disabledAt",
        "totalTimeSaved",
        "totalTimeWasted",
        "lastResetDate",
      ])
      .then((result) => {
        const salary = result.annualSalary || 0;
        const hourlyRate = salary / (365 * 24);

        // Check if we need to reset daily stats
        checkAndResetDaily(result);

        // Get current session time
        const now = Date.now();
        let currentSessionSaved = 0;
        let currentSessionWasted = 0;

        if (result.xFeedBlockerEnabled && result.enabledAt) {
          currentSessionSaved = now - result.enabledAt;
        } else if (!result.xFeedBlockerEnabled && result.disabledAt) {
          currentSessionWasted = now - result.disabledAt;
        }

        // Calculate stats based on period
        const stats = calculatePeriodStats(
          result,
          currentPeriod,
          currentSessionSaved,
          currentSessionWasted
        );

        // Update UI
        const savedHours = stats.timeSaved / (1000 * 60 * 60);
        const wastedHours = stats.timeWasted / (1000 * 60 * 60);
        const savedMoney = savedHours * hourlyRate;
        const lostMoney = wastedHours * hourlyRate;
        const net = savedMoney - lostMoney;

        moneySaved.textContent = `$${savedMoney.toFixed(2)}`;
        moneyLost.textContent = `$${lostMoney.toFixed(2)}`;
        netImpact.textContent = `${net >= 0 ? "+" : ""}$${net.toFixed(2)}`;
        netImpact.style.color = net >= 0 ? "#22c55e" : "#ef4444";

        timeSaved.textContent = formatTime(stats.timeSaved);
        timeWasted.textContent = formatTime(stats.timeWasted);

        if (net >= 0) {
          netSubtitle.textContent = "You're winning! 🎯";
        } else {
          netSubtitle.textContent = "Time to refocus 💪";
        }

        // Update chart (only for today)
        if (currentPeriod === "today") {
          updateWeekChart(result, hourlyRate);
        }

        // Update insights
        updateInsights(stats, net, salary);
      });
  }

  function checkAndResetDaily(result) {
    const today = new Date().toDateString();
    const lastReset = result.lastResetDate;

    if (lastReset !== today) {
      // Save today's stats to history before resetting
      const dailyStats = result.dailyStats || {};
      if (lastReset) {
        dailyStats[lastReset] = {
          timeSaved: result.totalTimeSaved || 0,
          timeWasted: result.totalTimeWasted || 0,
        };
      }

      // Reset ONLY daily counters, preserve all other data
      // IMPORTANT: Using spread operator to preserve annualSalary, advanced options, etc.
      browser.storage.local.get(null).then((allData) => {
        browser.storage.local.set({
          ...allData, // Preserve everything (salary, advanced options, etc)
          totalTimeSaved: 0,
          totalTimeWasted: 0,
          enabledAt: result.xFeedBlockerEnabled ? Date.now() : null,
          disabledAt: !result.xFeedBlockerEnabled ? Date.now() : null,
          lastResetDate: today,
          dailyStats: dailyStats,
        });
      });
    }
  }

  function calculatePeriodStats(
    result,
    period,
    currentSessionSaved,
    currentSessionWasted
  ) {
    const totalSaved = (result.totalTimeSaved || 0) + currentSessionSaved;
    const totalWasted = (result.totalTimeWasted || 0) + currentSessionWasted;

    switch (period) {
      case "today":
        return {
          timeSaved: totalSaved,
          timeWasted: totalWasted,
        };

      case "week":
        return calculateWeekStats(result, totalSaved, totalWasted);

      case "month":
        return calculateMonthStats(result, totalSaved, totalWasted);

      case "year":
        return calculateYearStats(result, totalSaved, totalWasted);

      case "all":
        return calculateAllTimeStats(result, totalSaved, totalWasted);

      default:
        return { timeSaved: 0, timeWasted: 0 };
    }
  }

  function calculateWeekStats(result, todaySaved, todayWasted) {
    const dailyStats = result.dailyStats || {};
    const last7Days = getLast7Days();

    let totalSaved = todaySaved;
    let totalWasted = todayWasted;

    last7Days.forEach((date) => {
      if (dailyStats[date]) {
        totalSaved += dailyStats[date].timeSaved || 0;
        totalWasted += dailyStats[date].timeWasted || 0;
      }
    });

    return { timeSaved: totalSaved, timeWasted: totalWasted };
  }

  function calculateMonthStats(result, todaySaved, todayWasted) {
    const dailyStats = result.dailyStats || {};
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let totalSaved = todaySaved;
    let totalWasted = todayWasted;

    Object.keys(dailyStats).forEach((dateStr) => {
      const date = new Date(dateStr);
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        totalSaved += dailyStats[dateStr].timeSaved || 0;
        totalWasted += dailyStats[dateStr].timeWasted || 0;
      }
    });

    return { timeSaved: totalSaved, timeWasted: totalWasted };
  }

  function calculateYearStats(result, todaySaved, todayWasted) {
    const dailyStats = result.dailyStats || {};
    const currentYear = new Date().getFullYear();

    let totalSaved = todaySaved;
    let totalWasted = todayWasted;

    Object.keys(dailyStats).forEach((dateStr) => {
      const date = new Date(dateStr);
      if (date.getFullYear() === currentYear) {
        totalSaved += dailyStats[dateStr].timeSaved || 0;
        totalWasted += dailyStats[dateStr].timeWasted || 0;
      }
    });

    return { timeSaved: totalSaved, timeWasted: totalWasted };
  }

  function calculateAllTimeStats(result, todaySaved, todayWasted) {
    const dailyStats = result.dailyStats || {};

    let totalSaved = todaySaved;
    let totalWasted = todayWasted;

    Object.keys(dailyStats).forEach((dateStr) => {
      totalSaved += dailyStats[dateStr].timeSaved || 0;
      totalWasted += dailyStats[dateStr].timeWasted || 0;
    });

    return { timeSaved: totalSaved, timeWasted: totalWasted };
  }

  function getLast7Days() {
    const days = [];
    for (let i = 1; i <= 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toDateString());
    }
    return days;
  }

  function updateWeekChart(result, hourlyRate) {
    const dailyStats = result.dailyStats || {};
    const last7Days = getLast7Days().reverse();
    const today = new Date().toDateString();

    weekChart.innerHTML = "";

    // Add today
    const todaySaved = (result.totalTimeSaved || 0) / (1000 * 60 * 60);
    const todayMoney = todaySaved * hourlyRate;
    addChartBar("Today", todayMoney);

    // Add last 7 days
    last7Days.forEach((dateStr) => {
      const date = new Date(dateStr);
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      const stats = dailyStats[dateStr] || { timeSaved: 0 };
      const hours = stats.timeSaved / (1000 * 60 * 60);
      const money = hours * hourlyRate;
      addChartBar(dayName, money);
    });
  }

  function addChartBar(label, value) {
    const maxValue = 100; // Max value for scaling
    const percentage = Math.min((value / maxValue) * 100, 100);

    const barItem = document.createElement("div");
    barItem.className = "bar-item";
    barItem.innerHTML = `
      <div class="bar-label">${label}</div>
      <div class="bar-container">
        <div class="bar-fill" style="width: ${percentage}%"></div>
      </div>
      <div class="bar-value">$${value.toFixed(2)}</div>
    `;
    weekChart.appendChild(barItem);
  }

  function updateInsights(stats, net, salary) {
    const savedHours = stats.timeSaved / (1000 * 60 * 60);
    const wastedHours = stats.timeWasted / (1000 * 60 * 60);

    if (net > 0) {
      insightTitle.textContent = "🎉 Excellent Progress!";
      insightText.textContent = `You've saved ${formatTime(
        stats.timeSaved
      )} of productive time. That's ${net.toFixed(
        2
      )} dollars you didn't waste on infinite scrolling. Keep up the great work!`;
    } else if (net === 0) {
      insightTitle.textContent = "⚖️ Break Even";
      insightText.textContent =
        "You're at a neutral point. Try to keep the extension enabled more to see positive results!";
    } else {
      insightTitle.textContent = "⚠️ Time to Refocus";
      insightText.textContent = `You've spent ${formatTime(
        stats.timeWasted
      )} scrolling. That's ${Math.abs(net).toFixed(
        2
      )} dollars of your time. Enable the blocker and reclaim your productivity!`;
    }

    if (!salary) {
      insightText.textContent +=
        " Set your annual salary in the popup to see the real financial impact.";
    }
  }

  function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    } else if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Cleanup
  window.addEventListener("unload", function () {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });
});

