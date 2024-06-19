import { writeFile } from 'fs/promises';
import { Queue } from 'bull';
import imgThumbnail from 'image-thumbnail';
import { ObjectId } from 'mongodb';
import dbClient from './utils/db';
import Mailer from './utils/mailer';

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
  await writeFile(`${filePath}_${size}`, buffer);
};

// Process tasks in the file queue
fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    throw new Error('fileId is required');
  }
  if (!userId) {
    throw new Error('userId is required');
  }

  console.log('Processing job:', job.data.name || '');

  const file = await dbClient.filesCollection.findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId),
  });

  if (!file) {
    throw new Error('File not found');
  }

  const sizes = [500, 250, 100];
  await Promise.all(sizes.map(size => createThumbnail(file.localPath, size)));
});

// Process tasks in the user queue
userQueue.process(async (job) => {
  const { userId } = job.data;

  if (!userId) {
    throw new Error('userId is required');
  }

  const user = await dbClient.usersCollection.findOne({ _id: ObjectId(userId) });

  if (!user) {
    throw new Error('User not found');
  }

  console.log(`Sending welcome email to ${user.email}`);

  try {
    const mailSubject = 'Welcome to ALX-Files_Manager by Ben Aicha Alae';
    const mailContent = [
      '<div>',
      '<h3>Hello ${user.name},</h3>',
      '<p>Welcome to <a href="https://example.com/my-awesome-app">My Awesome App</a>',
      'an innovative application designed to simplify your workflow, built with love by',
      '<a href="https://example.com">Your Name</a>', 
      'We hope you enjoy using it!</p>',
      '</div>',
    ].join('');
    
    await Mailer.sendMail(Mailer.buildMessage(user.email, mailSubject, mailContent));
  } catch (err) {
    throw new Error('Error sending email');
  }
});
