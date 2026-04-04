import { CONNECTION_STATES } from "../utils/constants";

export const initialPosts = [
  {
    id: "p1",
    author: "Ava Lin",
    timestamp: "2h ago",
    content: "Looking for people who enjoy museum weekends and long-form writing.",
    tags: ["culture", "writing"]
  },
  {
    id: "p2",
    author: "Noah Kim",
    timestamp: "5h ago",
    content: "Who else likes building side projects with clear product constraints?",
    tags: ["projects", "product"]
  }
];

export const initialThreads = [
  {
    id: "t1",
    name: "Maya Carter",
    status: CONNECTION_STATES.CONNECTED,
    lastPreview: "That sounds good, want to continue tomorrow?"
  },
  {
    id: "t2",
    name: "Ethan Park",
    status: CONNECTION_STATES.PAUSED,
    lastPreview: "Session paused by privacy settings."
  }
];

export const initialMessages = {
  t1: [
    { id: "m1", sender: "them", text: "Hey, your post on writing stood out.", time: "09:40" },
    { id: "m2", sender: "me", text: "Thanks, I like thoughtful conversations too.", time: "09:41" }
  ],
  t2: [{ id: "m3", sender: "system", text: "Conversation paused due to policy update.", time: "08:13" }]
};

export const initialProfile = {
  name: "Jordan Lee",
  bio: "Building respectful, high-signal conversations.",
  privacy: {
    allowed: ["hobbies", "goals"],
    sensitive: ["identity"],
    blocked: ["health", "finances"]
  }
};
