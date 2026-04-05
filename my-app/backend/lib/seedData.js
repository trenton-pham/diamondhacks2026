const jordan = require("../../demo-review/stored-users/jordan-lee.json");
const maya = require("../../demo-review/stored-users/maya-carter.json");
const ava = require("../../demo-review/stored-users/ava-lin.json");
const noah = require("../../demo-review/stored-users/noah-kim.json");
const serena = require("../../demo-review/stored-users/serena-patel.json");
const riley = require("../../demo-review/stored-users/riley-torres.json");
const blake = require("../../demo-review/stored-users/blake-mercer.json");

const TOPIC_NAMES = [
  "hobbies",
  "values",
  "interests",
  "humor",
  "dealbreakers",
  "communication_style",
  "lifestyle",
  "goals"
];

const currentUserId = "user-jordan";
const demoDatasetVersion = "demo-review-v1";

const candidateUsers = [
  {
    ...maya,
    agentHandle: "maya.agent",
    tags: ["community", "emotionally_mature", "ambition"]
  },
  {
    ...ava,
    agentHandle: "ava.agent",
    tags: ["culture", "writing", "warm"]
  },
  {
    ...noah,
    agentHandle: "noah.agent",
    tags: ["projects", "product", "builder"]
  },
  {
    ...serena,
    agentHandle: "serena.agent",
    tags: ["community", "social", "design"]
  },
  {
    ...riley,
    agentHandle: "riley.agent",
    tags: ["nightlife", "social", "spontaneous"]
  },
  {
    ...blake,
    agentHandle: "blake.agent",
    tags: ["low_effort", "detached", "blunt"]
  }
];

function withTime(day, hour, minute) {
  return new Date(Date.UTC(2026, 3, day, hour, minute, 0)).toISOString();
}

function makeMessage(id, threadId, sender, text, iso) {
  return {
    id,
    threadId,
    sender,
    text,
    time: new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    createdAt: iso
  };
}

function createSeedStore() {
  const users = {
    [currentUserId]: jordan,
    ...Object.fromEntries(candidateUsers.map((user) => [user.id, user]))
  };

  const posts = [
    {
      id: "p-maya",
      authorId: "user-maya",
      author: "Maya Carter",
      timestamp: withTime(4, 16, 10),
      content: "I love people who can be both ambitious and emotionally fluent. Good conversation and follow-through matter a lot to me.",
      tags: ["community", "intentional", "ambition"]
    },
    {
      id: "p-ava",
      authorId: "user-ava",
      author: "Ava Lin",
      timestamp: withTime(4, 15, 30),
      content: "Looking for people who enjoy museum weekends, bookstores, and long conversations that actually go somewhere.",
      tags: ["culture", "writing", "quiet_weekends"]
    },
    {
      id: "p-serena",
      authorId: "user-serena",
      author: "Serena Patel",
      timestamp: withTime(4, 15, 5),
      content: "I like thoughtful people who can move between ambitious work, community events, and low-key late-night debriefs.",
      tags: ["social", "community", "thoughtful"]
    },
    {
      id: "p-noah",
      authorId: "user-noah",
      author: "Noah Kim",
      timestamp: withTime(4, 14, 40),
      content: "Who else likes building side projects with clear constraints and talking through ideas over coffee?",
      tags: ["projects", "product", "builder"]
    },
    {
      id: "p-riley",
      authorId: "user-riley",
      author: "Riley Torres",
      timestamp: withTime(4, 14, 12),
      content: "I like spontaneous plans, loud nights, and people who can keep things light without overthinking everything.",
      tags: ["nightlife", "spontaneous", "social"]
    },
    {
      id: "p-blake",
      authorId: "user-blake",
      author: "Blake Mercer",
      timestamp: withTime(4, 13, 45),
      content: "I lose interest when people want too much emotional processing. I prefer things easy, fast, and low effort.",
      tags: ["blunt", "low_effort", "detached"]
    }
  ];

  const threads = [
    {
      id: "t-maya",
      participantIds: [currentUserId, "user-maya"],
      name: "Maya Carter",
      counterpartId: "user-maya",
      status: "connected",
      compatibilityScore: 0,
      confidence: "calibrated",
      intentSummary: "",
      lastPreview: "Same. I trust steady energy way more than instant chemistry.",
      updatedAt: withTime(4, 16, 45)
    },
    {
      id: "t-ava",
      participantIds: [currentUserId, "user-ava"],
      name: "Ava Lin",
      counterpartId: "user-ava",
      status: "connected",
      compatibilityScore: 0,
      confidence: "calibrated",
      intentSummary: "",
      lastPreview: "Perfect. I was hoping you would.",
      updatedAt: withTime(4, 16, 18)
    },
    {
      id: "t-serena",
      participantIds: [currentUserId, "user-serena"],
      name: "Serena Patel",
      counterpartId: "user-serena",
      status: "connected",
      compatibilityScore: 0,
      confidence: "calibrated",
      intentSummary: "",
      lastPreview: "Okay that actually sounds better than I expected from your post.",
      updatedAt: withTime(4, 15, 50)
    },
    {
      id: "t-noah",
      participantIds: [currentUserId, "user-noah"],
      name: "Noah Kim",
      counterpartId: "user-noah",
      status: "connected",
      compatibilityScore: 0,
      confidence: "calibrated",
      intentSummary: "",
      lastPreview: "Honestly that is still a decent start.",
      updatedAt: withTime(4, 15, 28)
    },
    {
      id: "t-riley",
      participantIds: [currentUserId, "user-riley"],
      name: "Riley Torres",
      counterpartId: "user-riley",
      status: "paused",
      compatibilityScore: 0,
      confidence: "degraded",
      intentSummary: "",
      lastPreview: "Honestly better to know now than after I drag you to something horrible.",
      updatedAt: withTime(4, 14, 58)
    },
    {
      id: "t-blake",
      participantIds: [currentUserId, "user-blake"],
      name: "Blake Mercer",
      counterpartId: "user-blake",
      status: "paused",
      compatibilityScore: 0,
      confidence: "degraded",
      intentSummary: "",
      lastPreview: "Probably. No hard feelings, just not the same wavelength.",
      updatedAt: withTime(4, 14, 20)
    }
  ];

  const messages = {
    "t-maya": [
      makeMessage("m-maya-1", "t-maya", "them", "Your post about wanting something calm but real stayed with me for some reason.", withTime(4, 16, 20)),
      makeMessage("m-maya-2", "t-maya", "me", "That is nice to hear. Yours stood out to me too, especially the part about ambition and emotional fluency.", withTime(4, 16, 22)),
      makeMessage("m-maya-3", "t-maya", "them", "I feel like everyone says they want depth, but not everyone means it in a livable way.", withTime(4, 16, 26)),
      makeMessage("m-maya-4", "t-maya", "me", "Exactly. I like depth that still feels grounded and easy to be inside of.", withTime(4, 16, 30)),
      makeMessage("m-maya-5", "t-maya", "them", "Same. Also your profile made me think you are probably good at picking dinner spots.", withTime(4, 16, 34)),
      makeMessage("m-maya-6", "t-maya", "me", "That is such a specific compliment, but yes, I take it seriously.", withTime(4, 16, 37)),
      makeMessage("m-maya-7", "t-maya", "them", "Good. Because I am very pro long dinner, second drink, accidental three-hour conversation.", withTime(4, 16, 40)),
      makeMessage("m-maya-8", "t-maya", "me", "That sounds ideal to me honestly.", withTime(4, 16, 43)),
      makeMessage("m-maya-9", "t-maya", "them", "Same. I trust steady energy way more than instant chemistry.", withTime(4, 16, 45))
    ],
    "t-ava": [
      makeMessage("m-ava-1", "t-ava", "me", "Your post made me laugh because museum plus bookstore is basically my default answer to everything.", withTime(4, 15, 52)),
      makeMessage("m-ava-2", "t-ava", "them", "Okay good, so you get it.", withTime(4, 15, 54)),
      makeMessage("m-ava-3", "t-ava", "them", "I am deeply suspicious of people who speedwalk through beautiful places.", withTime(4, 15, 56)),
      makeMessage("m-ava-4", "t-ava", "me", "Completely fair. Half the fun is lingering.", withTime(4, 15, 59)),
      makeMessage("m-ava-5", "t-ava", "them", "Exactly. I like conversations that move like that too.", withTime(4, 16, 3)),
      makeMessage("m-ava-6", "t-ava", "me", "That makes sense. What do you end up talking about for way too long with the right person?", withTime(4, 16, 8)),
      makeMessage("m-ava-7", "t-ava", "them", "Books, design, other people, and occasionally whether a city is emotionally stable.", withTime(4, 16, 12)),
      makeMessage("m-ava-8", "t-ava", "me", "That is such a specific category and I completely understand what you mean.", withTime(4, 16, 16)),
      makeMessage("m-ava-9", "t-ava", "them", "Perfect. I was hoping you would.", withTime(4, 16, 18))
    ],
    "t-serena": [
      makeMessage("m-serena-1", "t-serena", "them", "Your profile made me think you might actually know how to hold a conversation after an event instead of just saying \"fun night.\"", withTime(4, 15, 32)),
      makeMessage("m-serena-2", "t-serena", "me", "That is generous. Yours felt thoughtful too, just maybe more socially ambitious than mine.", withTime(4, 15, 35)),
      makeMessage("m-serena-3", "t-serena", "them", "That is definitely fair. I like a lively week, but I still need the conversation part to feel real.", withTime(4, 15, 39)),
      makeMessage("m-serena-4", "t-serena", "me", "Same. I am just probably more museum-and-dinner than event-and-afterparty.", withTime(4, 15, 42)),
      makeMessage("m-serena-5", "t-serena", "them", "Honestly that is probably healthy for me.", withTime(4, 15, 44)),
      makeMessage("m-serena-6", "t-serena", "me", "What kind of plans usually feel most like you?", withTime(4, 15, 47)),
      makeMessage("m-serena-7", "t-serena", "them", "Gallery opening, food somewhere good, then a long walk where the conversation gets a little too honest.", withTime(4, 15, 49)),
      makeMessage("m-serena-8", "t-serena", "me", "Okay that actually sounds better than I expected from your post.", withTime(4, 15, 50))
    ],
    "t-noah": [
      makeMessage("m-noah-1", "t-noah", "me", "Your post about side projects with constraints felt extremely targeted at my brain.", withTime(4, 15, 8)),
      makeMessage("m-noah-2", "t-noah", "them", "Then the post did its job.", withTime(4, 15, 10)),
      makeMessage("m-noah-3", "t-noah", "them", "Constraints make people reveal whether they actually have taste.", withTime(4, 15, 12)),
      makeMessage("m-noah-4", "t-noah", "me", "That is maybe too real. What are you building lately?", withTime(4, 15, 15)),
      makeMessage("m-noah-5", "t-noah", "them", "Mostly small product experiments and AI tools. If I go too long without making something I get annoying.", withTime(4, 15, 18)),
      makeMessage("m-noah-6", "t-noah", "me", "I get that. I like making things too, but I definitely need some quiet in the middle of it.", withTime(4, 15, 22)),
      makeMessage("m-noah-7", "t-noah", "them", "I am probably a little more go-go-go than you, but I respect the instinct.", withTime(4, 15, 26)),
      makeMessage("m-noah-8", "t-noah", "me", "That feels right. Similar curiosity, slightly different operating systems.", withTime(4, 15, 27)),
      makeMessage("m-noah-9", "t-noah", "them", "Honestly that is still a decent start.", withTime(4, 15, 28))
    ],
    "t-riley": [
      makeMessage("m-riley-1", "t-riley", "them", "You seem cool but I can already tell you would hate my ideal Friday.", withTime(4, 14, 46)),
      makeMessage("m-riley-2", "t-riley", "me", "That is probably fair. I definitely do slower better than chaos.", withTime(4, 14, 48)),
      makeMessage("m-riley-3", "t-riley", "them", "Yeah see I get bored if a chat gets reflective too fast.", withTime(4, 14, 50)),
      makeMessage("m-riley-4", "t-riley", "me", "I am kind of the opposite, which is good to know early.", withTime(4, 14, 53)),
      makeMessage("m-riley-5", "t-riley", "them", "I like last-minute plans and loud rooms and people who can keep up without needing a full briefing.", withTime(4, 14, 55)),
      makeMessage("m-riley-6", "t-riley", "me", "Yeah I think that is where we split.", withTime(4, 14, 57)),
      makeMessage("m-riley-7", "t-riley", "them", "Honestly better to know now than after I drag you to something horrible.", withTime(4, 14, 58))
    ],
    "t-blake": [
      makeMessage("m-blake-1", "t-blake", "me", "Your post was pretty direct, so now I am curious what you are actually looking for.", withTime(4, 14, 8)),
      makeMessage("m-blake-2", "t-blake", "them", "Honestly something easy. I do not really like when people make things heavier than they need to be.", withTime(4, 14, 10)),
      makeMessage("m-blake-3", "t-blake", "me", "That makes sense. I probably care more than average about consistency and how people show up.", withTime(4, 14, 14)),
      makeMessage("m-blake-4", "t-blake", "them", "Yeah that is probably where we differ. I usually think people should just relax.", withTime(4, 14, 17)),
      makeMessage("m-blake-5", "t-blake", "me", "I think that is probably a real mismatch then.", withTime(4, 14, 18)),
      makeMessage("m-blake-6", "t-blake", "them", "Probably. No hard feelings, just not the same wavelength.", withTime(4, 14, 20))
    ]
  };

  const sessions = Object.fromEntries(
    threads.map((thread) => [
      thread.id,
      {
        threadId: thread.id,
        usedMessages: messages[thread.id].filter((message) => message.sender === "me").length,
        turnRetryUsed: 0,
        connectionStatus: thread.status === "connected" ? "connected" : "paused",
        queueStatus: "normal",
        degradedMode: false
      }
    ])
  );

  const events = Object.fromEntries(
    threads.map((thread) => [
      thread.id,
      [
        {
          event_id: `evt-seed-${thread.id}`,
          stage: "summary_update",
          status: "ok",
          reason_code: "",
          timestamp: thread.updatedAt,
          turn_index: sessions[thread.id].usedMessages,
          queue_status: "normal",
          schema_version: "2026-04-06.v1"
        }
      ]
    ])
  );

  return {
    schemaVersion: "2026-04-06.v1",
    demoDatasetVersion,
    users,
    posts,
    threads,
    messages,
    sessions,
    events,
    recommendations: []
  };
}

module.exports = {
  TOPIC_NAMES,
  currentUserId,
  candidateUsers,
  demoDatasetVersion,
  createSeedStore
};
