// Statistics page script

document.addEventListener("DOMContentLoaded", function () {
  const periodButtons = document.querySelectorAll(".period-button");
  const moneySaved = document.getElementById("moneySaved");
  const moneyLost = document.getElementById("moneyLost");
  const netImpact = document.getElementById("netImpact");
  const timeSaved = document.getElementById("timeSaved");
  const timeWasted = document.getElementById("timeWasted");
  const netSubtitle = document.getElementById("netSubtitle");
  const insightTitle = document.getElementById("insightTitle");
  const insightText = document.getElementById("insightText");

  let currentPeriod = "today";
  let updateInterval = null;
  let updateCounter = 0;

  // Heartbeat constant for display calculations
  const MAX_HEARTBEAT_GAP = 5 * 60 * 1000; // 5 minutes - if gap is larger, assume Safari was closed

  // Period button handlers
  periodButtons.forEach((button) => {
    button.addEventListener("click", function () {
      periodButtons.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      currentPeriod = this.dataset.period;
      updateStats();
    });
  });

  // Trigger a heartbeat in background script when statistics page opens
  browser.runtime.sendMessage({ action: "forceHeartbeat" }).catch(() => {
    // Background might not be ready yet, that's ok
  });

  // Update stats with adaptive frequency for performance
  // First 5 minutes: every second, then every 10 seconds
  updateInterval = setInterval(() => {
    updateCounter++;
    const useSlowUpdate = updateCounter > 300; // After 5 minutes
    
    if (!useSlowUpdate || updateCounter % 10 === 0) {
      updateStats();
    }
  }, 1000);
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
        "lastHeartbeat",
      ])
      .then((result) => {
        // Check if we need to reset daily stats
        const needsReset = checkAndResetDaily(result, (newData) => {
          // After reset completes, display with new data
          displayStats(newData);
        });

        // If no reset needed, display with current data
        if (!needsReset) {
          displayStats(result);
        }
      });
  }

  function displayStats(result) {
    const salary = result.annualSalary || 0;
    const hourlyRate = salary / (365 * 24);

    // Get current session time (only count if Safari was actively running)
    const now = Date.now();
    const lastHeartbeat = result.lastHeartbeat || now;
    const timeSinceHeartbeat = now - lastHeartbeat;
    
    // Handle undefined xFeedBlockerEnabled (default to true = enabled)
    const isEnabled = result.xFeedBlockerEnabled !== false;
    
    // Only count time since last heartbeat if it's within the gap (Safari was open)
    let currentSessionSaved = 0;
    let currentSessionWasted = 0;

    if (timeSinceHeartbeat <= MAX_HEARTBEAT_GAP) {
      const activeTime = Math.max(0, timeSinceHeartbeat);
      if (isEnabled) {
        currentSessionSaved = activeTime;
      } else {
        currentSessionWasted = activeTime;
      }
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

    // Update insights
    updateInsights(stats, net, salary);
  }

  function checkAndResetDaily(result, callback) {
    const today = new Date().toDateString();
    const lastReset = result.lastResetDate;

    // If lastResetDate is not set, initialize it (first time user)
    if (!lastReset) {
      browser.storage.local.set({ lastResetDate: today }).then(() => {
        result.lastResetDate = today;
        if (callback) callback(result);
      });
      return true;
    }

    if (lastReset !== today) {
      const now = Date.now();
      const dailyStats = result.dailyStats || {};

      // With heartbeat system, totalTimeSaved/Wasted already contains
      // the ACTUAL time Safari was open (not theoretical time)
      const lastDayTimeSaved = result.totalTimeSaved || 0;
      const lastDayTimeWasted = result.totalTimeWasted || 0;

      // Save lastReset day's stats (this is accurate because heartbeat tracked it)
      dailyStats[lastReset] = {
        timeSaved: lastDayTimeSaved,
        timeWasted: lastDayTimeWasted,
      };

      // Handle SKIPPED DAYS - with heartbeat, Safari was closed so time = 0
      const lastResetDateObj = new Date(lastReset);
      const todayDateObj = new Date(today);
      const daysDiff = Math.floor(
        (todayDateObj - lastResetDateObj) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff > 1) {
        // Safari was closed on these days, so fill with zeros
        for (let i = 1; i < daysDiff; i++) {
          const skippedDate = new Date(lastResetDateObj);
          skippedDate.setDate(skippedDate.getDate() + i);
          const skippedDateStr = skippedDate.toDateString();

          if (!dailyStats[skippedDateStr]) {
            dailyStats[skippedDateStr] = {
              timeSaved: 0,
              timeWasted: 0,
            };
          }
        }
      }

      // Reset daily counters for today
      browser.storage.local.get(null).then((allData) => {
        const newData = {
          ...allData,
          totalTimeSaved: 0,
          totalTimeWasted: 0,
          enabledAt: result.xFeedBlockerEnabled ? now : null,
          disabledAt: !result.xFeedBlockerEnabled ? now : null,
          lastHeartbeat: now,
          lastResetDate: today,
          dailyStats: dailyStats,
        };

        browser.storage.local.set(newData).then(() => {
          if (callback) callback(newData);
        });
      });

      return true; // Reset is happening
    }
    return false; // No reset needed
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

  function getLast7Days() {
    const days = [];
    const today = new Date();
    
    // Get the last 6 days (not including today, since today's stats are passed separately)
    for (let i = 1; i <= 6; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      days.push(date.toDateString());
    }
    
    return days;
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
    const today = new Date();
    const todayStr = today.toDateString();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let totalSaved = todaySaved;
    let totalWasted = todayWasted;

    Object.keys(dailyStats).forEach((dateStr) => {
      // Skip today since it's already included in todaySaved/todayWasted
      if (dateStr === todayStr) return;
      
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
    const today = new Date();
    const todayStr = today.toDateString();
    const currentYear = today.getFullYear();

    let totalSaved = todaySaved;
    let totalWasted = todayWasted;

    Object.keys(dailyStats).forEach((dateStr) => {
      // Skip today since it's already included in todaySaved/todayWasted
      if (dateStr === todayStr) return;
      
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
    const todayStr = new Date().toDateString();

    let totalSaved = todaySaved;
    let totalWasted = todayWasted;

    Object.keys(dailyStats).forEach((dateStr) => {
      // Skip today since it's already included in todaySaved/todayWasted
      if (dateStr === todayStr) return;
      
      totalSaved += dailyStats[dateStr].timeSaved || 0;
      totalWasted += dailyStats[dateStr].timeWasted || 0;
    });

    return { timeSaved: totalSaved, timeWasted: totalWasted };
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
    // Trigger heartbeat in background when page closes
    browser.runtime.sendMessage({ action: "forceHeartbeat" }).catch(() => {});
  });

  // Also trigger heartbeat when page becomes hidden
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      browser.runtime.sendMessage({ action: "forceHeartbeat" }).catch(() => {});
    }
  });
});

