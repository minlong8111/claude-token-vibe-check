# Claude Usage Tracker

Track Claude Code usage, costs, and token consumption — all in VS Code.

> 100% local. No data leaves your machine. No API keys needed.

![Dashboard](images/imageH.png)
![Icon](images/imageIc.png)

## What it does

Claude Usage Tracker reads the JSONL log files that Claude Code generates locally (`~/.claude/projects/`) and presents them in a clean dashboard. It shows you:

- How much you're spending per day/month/project
- Which models you're using and their costs
- Token breakdown (input, output, cache read/write)
- Session history with duration

## Features

### Status Bar
Shows today's cost directly in VS Code's status bar. Click to open the full dashboard.

### Dashboard Tabs

| Tab | What it shows |
|-----|---------------|
| **Today** | Hourly breakdown, today's sessions, cost composition |
| **This Month** | Daily chart for current month, token composition |
| **All Time** | All data grouped by month, expandable daily rows |
| **Sessions** | All sessions sorted by time, with project and duration |
| **Projects** | Cost per project, session counts, last active time |

### Charts
- **Bar charts** — hourly/daily cost visualization
- **Token composition** — stacked bars showing input/output/cache breakdown
- **Cost composition** — horizontal bar showing cost by category

## Install

### From Marketplace
1. Open VS Code
2. Press `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Windows/Linux)
3. Search for "Claude Usage Tracker"
4. Click Install

### From VSIX
```bash
code --install-extension claude-usage-tracker-0.2.0.vsix
```

## Configuration

Open Settings (`Cmd+,`) and search for "Claude Usage Tracker", or edit `settings.json`:

```json
{
  "claudeBudget.refreshInterval": 60,
  "claudeBudget.dataDirectory": ""
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `refreshInterval` | 60 | How often to check for new data (seconds) |
| `dataDirectory` | "" | Custom Claude data directory (empty = auto-detect) |

## Commands

Open Command Palette (`Cmd+Shift+P`) and type:

| Command | Description |
|---------|-------------|
| `Claude Tracker: Open Dashboard` | Open the full dashboard |

## How it works

1. Claude Code writes usage logs to `~/.claude/projects/<project>/<session>.jsonl`
2. This extension reads those files on a timer (default: every 60 seconds)
3. It parses the JSONL entries to extract token usage, model, and timestamps
4. Data is aggregated by day, hour, session, and project
5. Dashboard renders the data with charts and tables

**No API calls. No network requests. Everything stays on your machine.**

## Privacy

- ✅ All data processing happens locally
- ✅ No data is sent to any server
- ✅ No API keys required
- ✅ No telemetry
- ✅ Open source — you can audit the code

## FAQ

**Q: Where does the data come from?**
A: From Claude Code's local JSONL logs in `~/.claude/projects/`. The extension reads these files directly.

**Q: Does this work with Claude API or only Claude Code?**
A: Only Claude Code. It reads the log files that Claude Code generates.

**Q: Can I track costs for different API keys?**
A: Not directly. Costs are tracked per project based on local Claude Code logs.

**Q: The dashboard shows "No data" — what's wrong?**
A: Make sure Claude Code has been used at least once. Check that `~/.claude/projects/` exists and contains `.jsonl` files.

**Q: Can I change the data directory?**
A: Yes, set `claudeBudget.dataDirectory` in settings to a custom path.

## Troubleshooting

**Dashboard is empty:**
- Ensure Claude Code has generated usage data
- Check `claudeBudget.dataDirectory` setting if using a custom path
- Try the "Refresh" button in the dashboard

**Wrong timezone:**
- Set `claudeBudget.timezone` to your IANA timezone (e.g., "America/New_York")

## License

MIT
