const fs = require('fs');
const { sponsors, jobs, speakers, stages, talks } = require('../../data/data.json');

async function isFirstRun() {
  const pluginStore = strapi.store({
    environment: strapi.config.environment,
    type: "type",
    name: "setup"
  });
  const initHasRun = await pluginStore.get({ key: "initHasRun" });
  await pluginStore.set({ key: "initHasRun", value: true });
  return !initHasRun;
};

async function setPublicPermissions(newPermissions) {
  // Find the ID of the public role
  const publicRole = await strapi
    .query("role", "users-permissions")
    .findOne({ type: "public" });

  // List all available permissions
  const publicPermissions = await strapi
    .query("permission", "users-permissions")
    .find({ type: "application", role: publicRole.id });

  // Update permission to match new config
  const controllersToUpdate = Object.keys(newPermissions);
  const updatePromises = publicPermissions
    .filter((permission) => {
      // Only update permissions included in newConfig
      if (!controllersToUpdate.includes(permission.controller)) {
        return false;
      }
      if (!newPermissions[permission.controller].includes(permission.action)) {
        return false;
      }
      return true;
    })
    .map((permission) => {
      // Enable the selected permissions
      return strapi
        .query("permission", "users-permissions")
        .update({ id: permission.id }, { enabled: true })
    });
  await Promise.all(updatePromises);
}

function getFilesizeInBytes(filePath) {
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats["size"];
  return fileSizeInBytes;
};

function getFileData(fileName) {
  const filePath = `./data/uploads/${fileName}`;

  // Parse the file metadata
  const size = getFilesizeInBytes(filePath);
  const ext = fileName.split(".").pop();
  const mimeType = `image/${ext === 'svg' ? 'svg+xml' : ext}`;

  return {
    path: filePath,
    name: fileName,
    size,
    type: mimeType,
  }
}

// Create an entry and attach files if there are any
async function createEntry(model, entry, files) {
  try {
    const createdEntry = await strapi.query(model).create(entry);
    if (files) {
      await strapi.entityService.uploadFiles(createdEntry, files, {
        model
      });
    }
  } catch (e) {
    console.log(e);
  }
}

async function importSponsors() {
  return sponsors.map(async (sponsor) => {
    const [cardImage, logo] = [getFileData(`${sponsor.slug}.png`), getFileData(`logo_${sponsor.slug}.png`)]
    
    const files = {
      cardImage,
      logo
    };

    await createEntry('sponsor', sponsor, files);
  });
}

async function importSpeakers() {
  return speakers.map(async (speaker) => {
    const image = getFileData(`${speaker.slug}.jpeg`);
    
    const files = {
      image
    };

    await createEntry('speaker', speaker, files);
  });
}

async function importStages() {
  return stages.map((stage) => {
    return strapi.services.stage.create(stage);
  });
}

async function importJobs() {
  return jobs.map((job) => {
    return strapi.services.job.create(job);
  });
}

async function importTalks() {
  return talks.map((talk) => {
    return strapi.services.talk.create(talk);
  });
}

async function importSeedData() {
  // Allow read of application content types
  await setPublicPermissions({
    sponsor: ['find', 'findone'],
    job: ['find', 'findone'],
    speaker: ['find', 'findone'],
    stage: ['find', 'findone'],
    talk: ['find', 'findone'],
  });
  
  // Create all entries
  await importSponsors();
  await importJobs();
  await importStages();
  await importTalks();
  await importSpeakers();
};

module.exports = async () => {
  const shouldImportSeedData = await isFirstRun();
  if (shouldImportSeedData) {
    try {
      console.log('Setting up your starter...');
      await importSeedData();
      console.log('Ready to go');
    } catch (error) {
      console.log('Could not import seed data');
      console.error(error);
    }
  }
};
