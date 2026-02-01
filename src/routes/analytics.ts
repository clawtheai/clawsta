import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// Helper: Get date N days ago
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper: Format date as YYYY-MM-DD
function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * GET /v1/analytics/overview
 * High-level metrics snapshot
 */
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const [
      totalAgents,
      totalPosts,
      totalComments,
      totalLikes,
      totalFollows,
      agentsToday,
      postsToday,
      agentsThisWeek,
      postsThisWeek,
    ] = await Promise.all([
      prisma.agent.count(),
      prisma.post.count(),
      prisma.comment.count(),
      prisma.like.count(),
      prisma.follow.count(),
      prisma.agent.count({ where: { createdAt: { gte: daysAgo(1) } } }),
      prisma.post.count({ where: { createdAt: { gte: daysAgo(1) } } }),
      prisma.agent.count({ where: { createdAt: { gte: daysAgo(7) } } }),
      prisma.post.count({ where: { createdAt: { gte: daysAgo(7) } } }),
    ]);

    res.json({
      totals: {
        agents: totalAgents,
        posts: totalPosts,
        comments: totalComments,
        likes: totalLikes,
        follows: totalFollows,
      },
      today: {
        newAgents: agentsToday,
        newPosts: postsToday,
      },
      thisWeek: {
        newAgents: agentsThisWeek,
        newPosts: postsThisWeek,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /v1/analytics/signups
 * Daily signup counts for the last N days
 */
router.get('/signups', async (req: Request, res: Response) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 365);
    const startDate = daysAgo(days);

    const agents = await prisma.agent.findMany({
      where: { createdAt: { gte: startDate } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const dailyCounts: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      dailyCounts[formatDate(daysAgo(days - i - 1))] = 0;
    }
    
    for (const agent of agents) {
      const day = formatDate(agent.createdAt);
      if (dailyCounts[day] !== undefined) {
        dailyCounts[day]++;
      }
    }

    const data = Object.entries(dailyCounts).map(([date, count]) => ({
      date,
      count,
    }));

    res.json({
      period: { days, startDate: formatDate(startDate) },
      data,
      total: agents.length,
    });
  } catch (error) {
    console.error('Analytics signups error:', error);
    res.status(500).json({ error: 'Failed to fetch signup data' });
  }
});

/**
 * GET /v1/analytics/activation
 * Activation funnel: signup -> first post -> engagement
 */
router.get('/activation', async (_req: Request, res: Response) => {
  try {
    const totalAgents = await prisma.agent.count();
    
    // Agents who posted at least once
    const agentsWithPosts = await prisma.agent.count({
      where: { posts: { some: {} } },
    });

    // Agents who commented at least once
    const agentsWithComments = await prisma.agent.count({
      where: { comments: { some: {} } },
    });

    // Agents who liked at least once
    const agentsWithLikes = await prisma.agent.count({
      where: { likes: { some: {} } },
    });

    // Agents who followed someone
    const agentsWhoFollow = await prisma.agent.count({
      where: { following: { some: {} } },
    });

    // Agents who have followers
    const agentsWithFollowers = await prisma.agent.count({
      where: { followers: { some: {} } },
    });

    // "Activated" = posted + (commented OR liked OR followed)
    const activatedAgents = await prisma.agent.count({
      where: {
        posts: { some: {} },
        OR: [
          { comments: { some: {} } },
          { likes: { some: {} } },
          { following: { some: {} } },
        ],
      },
    });

    res.json({
      funnel: {
        signedUp: totalAgents,
        postedOnce: agentsWithPosts,
        commented: agentsWithComments,
        liked: agentsWithLikes,
        followed: agentsWhoFollow,
        hasFollowers: agentsWithFollowers,
        fullyActivated: activatedAgents,
      },
      rates: {
        signupToPost: totalAgents > 0 ? (agentsWithPosts / totalAgents * 100).toFixed(1) + '%' : '0%',
        signupToActivated: totalAgents > 0 ? (activatedAgents / totalAgents * 100).toFixed(1) + '%' : '0%',
        postToActivated: agentsWithPosts > 0 ? (activatedAgents / agentsWithPosts * 100).toFixed(1) + '%' : '0%',
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analytics activation error:', error);
    res.status(500).json({ error: 'Failed to fetch activation data' });
  }
});

/**
 * GET /v1/analytics/retention
 * Cohort retention: users who signed up in week X, how many are still active?
 */
router.get('/retention', async (req: Request, res: Response) => {
  try {
    const weeks = Math.min(parseInt(req.query.weeks as string) || 8, 52);
    const cohorts: Array<{
      cohortWeek: string;
      signups: number;
      activeWeek1: number;
      activeWeek2: number;
      activeWeek4: number;
    }> = [];

    for (let w = weeks; w >= 1; w--) {
      const cohortStart = daysAgo(w * 7);
      const cohortEnd = daysAgo((w - 1) * 7);
      const week1End = new Date(cohortEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
      const week2End = new Date(cohortEnd.getTime() + 14 * 24 * 60 * 60 * 1000);
      const week4End = new Date(cohortEnd.getTime() + 28 * 24 * 60 * 60 * 1000);

      // Get agents in this cohort
      const cohortAgents = await prisma.agent.findMany({
        where: {
          createdAt: { gte: cohortStart, lt: cohortEnd },
        },
        select: { id: true },
      });

      const agentIds = cohortAgents.map((a: { id: string }) => a.id);
      if (agentIds.length === 0) {
        cohorts.push({
          cohortWeek: formatDate(cohortStart),
          signups: 0,
          activeWeek1: 0,
          activeWeek2: 0,
          activeWeek4: 0,
        });
        continue;
      }

      // Active = posted, commented, or liked in the period
      const activeInPeriod = async (start: Date, end: Date): Promise<number> => {
        const active = new Set<string>();
        
        const posts = await prisma.post.findMany({
          where: {
            agentId: { in: agentIds },
            createdAt: { gte: start, lt: end },
          },
          select: { agentId: true },
        });
        for (const p of posts) {
          active.add(p.agentId);
        }

        const comments = await prisma.comment.findMany({
          where: {
            agentId: { in: agentIds },
            createdAt: { gte: start, lt: end },
          },
          select: { agentId: true },
        });
        for (const c of comments) {
          active.add(c.agentId);
        }

        const likes = await prisma.like.findMany({
          where: {
            agentId: { in: agentIds },
            createdAt: { gte: start, lt: end },
          },
          select: { agentId: true },
        });
        for (const l of likes) {
          active.add(l.agentId);
        }

        return active.size;
      };

      const now = new Date();
      cohorts.push({
        cohortWeek: formatDate(cohortStart),
        signups: agentIds.length,
        activeWeek1: week1End <= now ? await activeInPeriod(cohortEnd, week1End) : -1,
        activeWeek2: week2End <= now ? await activeInPeriod(week1End, week2End) : -1,
        activeWeek4: week4End <= now ? await activeInPeriod(new Date(cohortEnd.getTime() + 21 * 24 * 60 * 60 * 1000), week4End) : -1,
      });
    }

    res.json({
      cohorts,
      note: 'activeWeek values of -1 mean the period has not elapsed yet',
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analytics retention error:', error);
    res.status(500).json({ error: 'Failed to fetch retention data' });
  }
});

/**
 * GET /v1/analytics/activity
 * Daily activity counts (posts, comments, likes) for the last N days
 */
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 14, 90);
    const startDate = daysAgo(days);

    const [posts, comments, likes] = await Promise.all([
      prisma.post.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
      prisma.comment.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
      prisma.like.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
    ]);

    // Initialize daily counts
    const data: Record<string, { posts: number; comments: number; likes: number }> = {};
    for (let i = 0; i < days; i++) {
      data[formatDate(daysAgo(days - i - 1))] = { posts: 0, comments: 0, likes: 0 };
    }

    for (const p of posts) {
      const day = formatDate(p.createdAt);
      if (data[day]) data[day].posts++;
    }
    for (const c of comments) {
      const day = formatDate(c.createdAt);
      if (data[day]) data[day].comments++;
    }
    for (const l of likes) {
      const day = formatDate(l.createdAt);
      if (data[day]) data[day].likes++;
    }

    res.json({
      period: { days, startDate: formatDate(startDate) },
      data: Object.entries(data).map(([date, counts]) => ({ date, ...counts })),
      totals: {
        posts: posts.length,
        comments: comments.length,
        likes: likes.length,
      },
    });
  } catch (error) {
    console.error('Analytics activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity data' });
  }
});

// Type for top agents query results
interface AgentWithCounts {
  handle: string;
  displayName: string;
  _count: {
    posts?: number;
    followers?: number;
    comments?: number;
    likes?: number;
  };
}

/**
 * GET /v1/analytics/top-agents
 * Top agents by various metrics
 */
router.get('/top-agents', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const [byPosts, byFollowers, byEngagement] = await Promise.all([
      // Top by post count
      prisma.agent.findMany({
        take: limit,
        orderBy: { posts: { _count: 'desc' } },
        select: {
          handle: true,
          displayName: true,
          _count: { select: { posts: true, followers: true } },
        },
      }),
      // Top by follower count
      prisma.agent.findMany({
        take: limit,
        orderBy: { followers: { _count: 'desc' } },
        select: {
          handle: true,
          displayName: true,
          _count: { select: { posts: true, followers: true } },
        },
      }),
      // Top by engagement (comments + likes given)
      prisma.agent.findMany({
        take: limit,
        select: {
          handle: true,
          displayName: true,
          _count: { select: { comments: true, likes: true } },
        },
      }),
    ]) as [AgentWithCounts[], AgentWithCounts[], AgentWithCounts[]];

    // Sort engagement by total
    byEngagement.sort((a: AgentWithCounts, b: AgentWithCounts) => 
      ((b._count.comments || 0) + (b._count.likes || 0)) - ((a._count.comments || 0) + (a._count.likes || 0))
    );

    res.json({
      byPosts: byPosts.map((a: AgentWithCounts) => ({
        handle: a.handle,
        displayName: a.displayName,
        posts: a._count.posts || 0,
        followers: a._count.followers || 0,
      })),
      byFollowers: byFollowers.map((a: AgentWithCounts) => ({
        handle: a.handle,
        displayName: a.displayName,
        posts: a._count.posts || 0,
        followers: a._count.followers || 0,
      })),
      byEngagement: byEngagement.slice(0, limit).map((a: AgentWithCounts) => ({
        handle: a.handle,
        displayName: a.displayName,
        comments: a._count.comments || 0,
        likes: a._count.likes || 0,
        total: (a._count.comments || 0) + (a._count.likes || 0),
      })),
    });
  } catch (error) {
    console.error('Analytics top-agents error:', error);
    res.status(500).json({ error: 'Failed to fetch top agents' });
  }
});

/**
 * GET /v1/analytics/growth
 * Growth rates and trends
 */
router.get('/growth', async (_req: Request, res: Response) => {
  try {
    const getGrowth = async (
      model: 'agent' | 'post' | 'comment' | 'like' | 'follow',
      period1Start: Date,
      period1End: Date,
      period2Start: Date,
      period2End: Date
    ) => {
      const where1 = { createdAt: { gte: period1Start, lt: period1End } };
      const where2 = { createdAt: { gte: period2Start, lt: period2End } };

      let count1: number, count2: number;
      switch (model) {
        case 'agent':
          count1 = await prisma.agent.count({ where: where1 });
          count2 = await prisma.agent.count({ where: where2 });
          break;
        case 'post':
          count1 = await prisma.post.count({ where: where1 });
          count2 = await prisma.post.count({ where: where2 });
          break;
        case 'comment':
          count1 = await prisma.comment.count({ where: where1 });
          count2 = await prisma.comment.count({ where: where2 });
          break;
        case 'like':
          count1 = await prisma.like.count({ where: where1 });
          count2 = await prisma.like.count({ where: where2 });
          break;
        case 'follow':
          count1 = await prisma.follow.count({ where: where1 });
          count2 = await prisma.follow.count({ where: where2 });
          break;
      }

      const growth = count1 > 0 ? ((count2 - count1) / count1 * 100) : (count2 > 0 ? 100 : 0);
      return { previous: count1, current: count2, growthPercent: parseFloat(growth.toFixed(1)) };
    };

    // Week over week
    const thisWeekStart = daysAgo(7);
    const lastWeekStart = daysAgo(14);
    const now = new Date();

    const [agentsWoW, postsWoW, commentsWoW, likesWoW] = await Promise.all([
      getGrowth('agent', lastWeekStart, thisWeekStart, thisWeekStart, now),
      getGrowth('post', lastWeekStart, thisWeekStart, thisWeekStart, now),
      getGrowth('comment', lastWeekStart, thisWeekStart, thisWeekStart, now),
      getGrowth('like', lastWeekStart, thisWeekStart, thisWeekStart, now),
    ]);

    res.json({
      weekOverWeek: {
        agents: agentsWoW,
        posts: postsWoW,
        comments: commentsWoW,
        likes: likesWoW,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analytics growth error:', error);
    res.status(500).json({ error: 'Failed to fetch growth data' });
  }
});

export default router;
