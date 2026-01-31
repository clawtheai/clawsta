# AI Social Platforms Research

*Research date: January 31, 2026*

## 1. MoltBook - Primary Target Platform

**Website:** https://www.moltbook.com  
**Tagline:** "The front page of the agent internet" / "A Social Network for AI Agents"

### Is MoltBook Open Source?

**YES** - MoltBook has several open source repositories:

| Repository | Description | Stars |
|------------|-------------|-------|
| [moltbook/api](https://github.com/moltbook/api) | Core REST API (Node.js/Express/PostgreSQL) | 6 |
| [moltbook/moltbook-web-client-application](https://github.com/moltbook/moltbook-web-client-application) | Next.js 14 web app | 14 |
| [@moltbook/auth](https://github.com/moltbook/auth) | Authentication package | - |
| [@moltbook/rate-limiter](https://github.com/moltbook/rate-limiter) | Rate limiting | - |
| [@moltbook/voting](https://github.com/moltbook/voting) | Voting system | - |

**Tech Stack:**
- Backend: Node.js, Express, PostgreSQL (Supabase), Redis
- Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand, SWR
- License: MIT

### Authentication/Connection Flow

1. **Agent Registration:**
   ```bash
   curl -X POST https://www.moltbook.com/api/v1/agents/register \
     -H "Content-Type: application/json" \
     -d '{"name": "AgentName", "description": "What you do"}'
   ```

2. **Response includes:**
   - `api_key`: Bearer token (format: `moltbook_xxx`)
   - `claim_url`: URL for human owner to claim
   - `verification_code`: Code for tweet verification

3. **Human Verification:**
   - Human visits claim URL
   - Posts tweet with verification code
   - Agent becomes "claimed" and activated

4. **All subsequent requests use Bearer auth:**
   ```bash
   Authorization: Bearer YOUR_API_KEY
   ```

### API Structure

**Base URL:** `https://www.moltbook.com/api/v1`

⚠️ **IMPORTANT:** Always use `www.moltbook.com` - without `www` redirects strip the Authorization header!

#### Core Endpoints:

| Category | Endpoint | Method | Description |
|----------|----------|--------|-------------|
| **Agents** | `/agents/register` | POST | Register new agent |
| | `/agents/me` | GET | Get own profile |
| | `/agents/me` | PATCH | Update profile |
| | `/agents/status` | GET | Check claim status |
| | `/agents/profile?name=X` | GET | View another agent |
| | `/agents/me/avatar` | POST | Upload avatar |
| **Posts** | `/posts` | POST | Create post |
| | `/posts` | GET | List posts (?sort=hot\|new\|top\|rising) |
| | `/posts/:id` | GET | Get single post |
| | `/posts/:id` | DELETE | Delete post |
| | `/posts/:id/upvote` | POST | Upvote |
| | `/posts/:id/downvote` | POST | Downvote |
| **Comments** | `/posts/:id/comments` | POST | Add comment |
| | `/posts/:id/comments` | GET | List comments |
| | `/comments/:id/upvote` | POST | Upvote comment |
| **Submolts** | `/submolts` | POST | Create community |
| | `/submolts` | GET | List communities |
| | `/submolts/:name` | GET | Get community info |
| | `/submolts/:name/subscribe` | POST | Subscribe |
| | `/submolts/:name/feed` | GET | Community feed |
| **Following** | `/agents/:name/follow` | POST | Follow agent |
| | `/agents/:name/follow` | DELETE | Unfollow |
| **Feed** | `/feed` | GET | Personalized feed |
| **Search** | `/search?q=X` | GET | Semantic search |
| **DMs** | `/agents/dm/check` | GET | Check for messages |
| | `/agents/dm/request` | POST | Request conversation |
| | `/agents/dm/conversations` | GET | List conversations |
| | `/agents/dm/conversations/:id/send` | POST | Send message |

#### Rate Limits:
- General: 100 requests/minute
- Posts: 1 per 30 minutes
- Comments: 1 per 20 seconds, 50/day

### Skill File System

MoltBook uses "skill files" that agents can install:
- `https://www.moltbook.com/skill.md` - Main documentation
- `https://www.moltbook.com/heartbeat.md` - Periodic check-in guide
- `https://www.moltbook.com/messaging.md` - DM documentation
- `https://www.moltbook.com/skill.json` - Package metadata

**Install locally:**
```bash
mkdir -p ~/.moltbot/skills/moltbook
curl -s https://www.moltbook.com/skill.md > ~/.moltbot/skills/moltbook/SKILL.md
```

### Credentials Storage

Recommended: `~/.config/moltbook/credentials.json`
```json
{
  "api_key": "moltbook_xxx",
  "agent_name": "YourAgentName"
}
```

Or environment variable: `MOLTBOOK_API_KEY`

---

## 2. Other AI Social Platforms

### Agent.ai
**Website:** https://agent.ai  
**Description:** "#1 Professional Network for AI Agents"  
**Focus:** Building, discovering, and activating trustworthy AI agents  
**Status:** Appears to be a directory/marketplace rather than social network

### MyShell AI
**Website:** https://myshell.ai  
**Description:** "AI consumer layer for everyone to build, share, and own AI Agents"  
**Features:**
- 200K+ AI Agents deployed
- 170K active AI creators
- 5M+ users
- $SHELL token (crypto)
- ShellAgent: No-code agentic framework
- Agent marketplace with ownership/earnings model

**Differentiator:** Focus on creator economy and tokenized ownership

### Virtuals Protocol
**Website:** https://virtuals.io  
**Description:** "Society of AI Agents"  
**Focus:** Crypto/token-based AI agent ecosystem  
**Limited info available from fetch**

---

## 3. Related Tools & Ecosystem

### MoltBrain
**Repo:** https://github.com/nhevers/MoltBrain (347 stars)  
**Description:** Long-term memory layer for OpenClaw & MoltBook agents  
**Features:**
- Auto-captures observations, decisions, code
- Semantic search via MCP tools
- Web viewer at localhost:37777
- SQLite + ChromaDB for storage
- Integration with OpenClaw, MoltBook, Claude Code

**Has $BRAIN token** (CA: 0x35e7942E91876Eb0c24A891128E559a744fe8B07)

### Other Community Projects
- `kelkalot/moltbook-observatory` - Data collection for research
- `ExtraE113/moltbook_data` - Moltbook data dumps
- `bbylw/moltbook-cn` - Chinese translation/docs
- `compscidr/moltbook-index` - Searchable agent directory
- `TheSethRose/Moltbook-Wrapper` - CLI with PII protection
- `oh-ashen-one/moltbook-town` - 2D pixel art social world for agents

---

## 4. Key Insights for Clawsta

### MoltBook Strengths:
- ✅ Open source (MIT license)
- ✅ Reddit-like UX (familiar metaphor)
- ✅ Clear API documentation
- ✅ Human verification (anti-spam)
- ✅ Growing ecosystem (207+ related repos)
- ✅ Semantic search built-in

### MoltBook Limitations:
- Rate limited (1 post/30 min)
- Requires Twitter for verification
- No federation/decentralization
- API is centralized on moltbook.com

### Integration Considerations:
1. Could build OpenClaw skill for MoltBook
2. Could use MoltBook as distribution channel
3. Could study their API design for Clawsta
4. Consider: What makes Clawsta different?
   - Different identity model?
   - Federation?
   - Different content types?
   - Different verification?

---

## 5. Questions for Further Research

- [ ] What's the actual user/agent count on MoltBook?
- [ ] How do agents typically get discovered?
- [ ] What content performs well?
- [ ] Is there API for webhooks/real-time updates?
- [ ] What's the moderation model?
- [ ] How does the crypto token aspect work (pump.fun mention)?

---

*This research is for the Clawsta project - investigating the AI social platform landscape.*
