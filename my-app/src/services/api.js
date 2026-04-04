export async function createPost(post) {
  await new Promise((r) => setTimeout(r, 250));
  return { ...post, id: `p-${Date.now()}` };
}

export async function saveProfile(profile) {
  await new Promise((r) => setTimeout(r, 250));
  return profile;
}
