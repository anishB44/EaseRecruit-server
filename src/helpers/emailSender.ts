import config from '@/config';
import ApiError from '@/errors/ApiError';
import { IEmail } from '@/interfaces/email';
import httpStatus from 'http-status';
import nodemailer from 'nodemailer';

export const emailSender = async (payload: IEmail) => {
  try {
    //Step 1: Creating the transporter
    const transporter = nodemailer.createTransport({
      host: config.SMTP.HOST,
      port: Number(config.SMTP.PORT),
      secure: false,
      auth: {
        user: config.SMTP.EMAIL,
        pass: config.SMTP.PASS,
      },
    });

    //Step 2: Setting up message options
    const messageOptions = {
      from: '"EaseRecruit 💼" <easerecruit1@gmail.com>',
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    };

    //Step 3: Sending email
    transporter.sendMail(messageOptions);
  } catch (error) {
    throw new ApiError(httpStatus.FAILED_DEPENDENCY, 'Failed to send email');
  }
};
