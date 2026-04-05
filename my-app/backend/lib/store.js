const fs = require("fs");
const path = require("path");
const { createSeedStore, demoDatasetVersion } = require("./seedData");

const dataDir = path.join(__dirname, "..", "data");
const storePath = path.join(dataDir, "store.json");
const profilesDir = path.join(dataDir, "profiles");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function persistProfileFiles(store) {
  ensureDir(profilesDir);
  Object.values(store.users).forEach((user) => {
    const userDir = path.join(profilesDir, user.id);
    ensureDir(userDir);
    Object.entries(user.topicFiles || {}).forEach(([topic, contents]) => {
      fs.writeFileSync(path.join(userDir, `${topic}.md`), contents, "utf8");
    });
  });
}

function mergeStoreWithSeed(store) {
  const seed = createSeedStore();
  if (store.demoDatasetVersion !== demoDatasetVersion) {
    return seed;
  }

  const nextStore = {
    ...seed,
    ...store,
    users: { ...seed.users, ...(store.users || {}) }
  };

  Object.keys(nextStore.users).forEach((userId) => {
    nextStore.users[userId] = {
      ...seed.users[userId],
      ...nextStore.users[userId],
      privacy: {
        ...(seed.users[userId]?.privacy || {}),
        ...(nextStore.users[userId]?.privacy || {})
      },
      questionnaire:
        nextStore.users[userId]?.questionnaire ||
        seed.users[userId]?.questionnaire || {
          completed: false,
          answers: {}
        },
      topicFiles: {
        ...(seed.users[userId]?.topicFiles || {}),
        ...(nextStore.users[userId]?.topicFiles || {})
      }
    };
  });

  return nextStore;
}

function ensureStore() {
  ensureDir(dataDir);
  if (!fs.existsSync(storePath)) {
    const seed = createSeedStore();
    writeJson(storePath, seed);
    persistProfileFiles(seed);
    return seed;
  }

  const store = mergeStoreWithSeed(readJson(storePath));
  writeJson(storePath, store);
  persistProfileFiles(store);
  return store;
}

function getStore() {
  return ensureStore();
}

function saveStore(store) {
  writeJson(storePath, store);
  persistProfileFiles(store);
}

module.exports = {
  getStore,
  saveStore,
  profilesDir
};
