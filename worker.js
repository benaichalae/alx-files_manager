/* eslint-disable import/no-named-as-default */
import { writeFile } from 'fs';
import { promisify } from 'util';
import Queue from 'bull/lib/queue';
import imgThumbnail from 'image-thumbnail';
import mongoDBCore from 'mongodb/lib/core';
import dbClient from './utils/db';
import Mailer from './utils/mailer';

const writeFileAsync = promisify(writeFile);
const fileQueue = new Queue('thumbnail generation');
const userQueue = new Queue('email sending');

/**
 * Creates a thumbnail for a given image with specified dimensions.
 * @param {String} filePath - Path to the original image file.
 * @param {number} size - Width of the desired thumbnail.
 * @returns {Promise<void>}
 */
const createThumbnail = async (filePath, size) => {
  const buffer = await imgThumbnail(filePath, { width: size });
  console.log(`Creating thumbnail for: ${filePath} with width: ${size}`);
  return writeFileAsync(`${filePath}_${size}`, buffer);
};

// Process tasks in the file queue
fileQueue.process(async (job, done) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    throw new Error('fileId is required');
  }
  if (!userId) {
    throw new Error('userId is required');
  }

  console.log('Processing job:', job.data.name || '');

  const file = await (await dbClient.filesCollection())
    .findOne({
      _id: new mongoDBCore.BSON.ObjectId(fileId),
      userId: new mongoDBCore.BSON.ObjectId(userId),
    });

  if (!file) {
    throw new Error('File not found');
  }

  const sizes = [500, 250, 100];
  Promise.all(sizes.map(size => createThumbnail(file.localPath, size)))
    .then(() => done())
    .catch(err => done(err));
});

// Process tasks in the user queue
userQueue.process(async (job, done) => {
  const { userId } = job.data;

  if (!userId) {
    throw new Error('userId is required');
  }

  const user = await (await dbClient.usersCollection())
    .findOne({ _id: new mongoDBCore.BSON.ObjectId(userId) });

  if (!user) {
    throw new Error('User not found');
  }

  console.log(`Sending welcome email to ${user.email}`);

  try {
    const subject = 'Welcome to ALX-Files_Manager';
    const content = `
      <div>
        <h3>Hello ${user.name},</h3>
        <p>Welcome to <a href="https://github.com/B3zaleel/alx-files_manager">ALX-Files_Manager</a>, 
        a simple file management API built with Node.js by 
        <a href="https://github.com/B3zaleel">Bezaleel Olakunori</a>. 
        We hope it meets your needs.</p>
      </div>`;
    
    await Mailer.sendMail(Mailer.buildMessage(user.email, subject, content));
    done();
  } catch (err) {
    done(err);
  }
});
