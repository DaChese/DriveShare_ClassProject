/*
 * Author:Aldo Medina and Rania Dayekh
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Sends DriveShare email notifications for booking and message events.
 */

// =============================================
// IMPORTS
// =============================================

import nodemailer from "nodemailer";

// =============================================
// EMAIL SERVICE
// =============================================

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || "your-email@gmail.com",
        pass: process.env.SMTP_PASS || "your-app-password"
      }
    });

    this.enabled = process.env.EMAIL_ENABLED === "true";
  }

  // =============================================
  // CORE SEND HELPERS
  // =============================================

  async sendEmail(to, subject, html, text = "") {
    if (!this.enabled) {
      console.log(`[email disabled] Would send to ${to}: ${subject}`);
      return true;
    }

    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || "driveshare@example.com",
        to,
        subject,
        html,
        text: text || this.stripHtml(html)
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[email sent] ${to}: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error(`[email failed] ${to}:`, error.message);
      return false;
    }
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  }

  // =============================================
  // NOTIFICATION EMAILS
  // =============================================

  async sendBookingRequest(ownerEmail, renterName, booking, car) {
    const subject = `New Booking Request - ${car.title || `${car.year} ${car.make} ${car.model}`}`;
    const html = `
      <h2>New Booking Request</h2>
      <p>Hello! You have received a new booking request.</p>
      <h3>Booking Details:</h3>
      <ul>
        <li><strong>Car:</strong> ${car.title || `${car.year} ${car.make} ${car.model}`}</li>
        <li><strong>Renter:</strong> ${renterName}</li>
        <li><strong>Dates:</strong> ${booking.start_date} to ${booking.end_date}</li>
        <li><strong>Total:</strong> $${(booking.total_cents / 100).toFixed(2)}</li>
        <li><strong>Booking ID:</strong> ${booking.id}</li>
      </ul>
      <p>Please log in to DriveShare to confirm or decline this booking.</p>
      <p><a href="http://localhost:3000">View on DriveShare</a></p>
    `;

    return await this.sendEmail(ownerEmail, subject, html);
  }

  async sendBookingConfirmation(renterEmail, ownerName, booking, car) {
    const subject = `Booking Confirmed - ${car.title || `${car.year} ${car.make} ${car.model}`}`;
    const html = `
      <h2>Booking Confirmed!</h2>
      <p>Your booking has been confirmed.</p>
      <h3>Booking Details:</h3>
      <ul>
        <li><strong>Car:</strong> ${car.title || `${car.year} ${car.make} ${car.model}`}</li>
        <li><strong>Owner:</strong> ${ownerName}</li>
        <li><strong>Dates:</strong> ${booking.start_date} to ${booking.end_date}</li>
        <li><strong>Total:</strong> $${(booking.total_cents / 100).toFixed(2)}</li>
        <li><strong>Booking ID:</strong> ${booking.id}</li>
      </ul>
      <p>You can now contact the owner to arrange pickup details.</p>
      <p><a href="http://localhost:3000/messages.html">Message the Owner</a></p>
    `;

    return await this.sendEmail(renterEmail, subject, html);
  }

  async sendPaymentNotification(ownerEmail, renterName, booking, car) {
    const subject = `Payment Received - Booking #${booking.id}`;
    const html = `
      <h2>Payment Received!</h2>
      <p>You have received payment for your car rental.</p>
      <h3>Payment Details:</h3>
      <ul>
        <li><strong>Car:</strong> ${car.title || `${car.year} ${car.make} ${car.model}`}</li>
        <li><strong>Renter:</strong> ${renterName}</li>
        <li><strong>Amount:</strong> $${(booking.total_cents / 100).toFixed(2)}</li>
        <li><strong>Booking ID:</strong> ${booking.id}</li>
      </ul>
      <p>The booking is now confirmed and ready to proceed.</p>
    `;

    return await this.sendEmail(ownerEmail, subject, html);
  }

  async sendReviewNotification(revieweeEmail, reviewerName, review, booking) {
    const subject = `New Review from ${reviewerName}`;
    const stars = "*".repeat(review.rating) + "-".repeat(5 - review.rating);
    const html = `
      <h2>New Review Received</h2>
      <p>You have received a new review for booking #${booking.id}.</p>
      <h3>Review Details:</h3>
      <ul>
        <li><strong>Reviewer:</strong> ${reviewerName}</li>
        <li><strong>Rating:</strong> ${stars} (${review.rating}/5)</li>
        ${review.comment ? `<li><strong>Comment:</strong> "${review.comment}"</li>` : ""}
      </ul>
      <p><a href="http://localhost:3000/history.html">View in History</a></p>
    `;

    return await this.sendEmail(revieweeEmail, subject, html);
  }

  async sendMessageNotification(recipientEmail, senderName, car) {
    const subject = `New Message - ${car.title || `${car.year} ${car.make} ${car.model}`}`;
    const html = `
      <h2>New Message</h2>
      <p>You have received a new message about your car rental.</p>
      <ul>
        <li><strong>From:</strong> ${senderName}</li>
        <li><strong>Car:</strong> ${car.title || `${car.year} ${car.make} ${car.model}`}</li>
      </ul>
      <p><a href="http://localhost:3000/messages.html">View Messages</a></p>
    `;

    return await this.sendEmail(recipientEmail, subject, html);
  }
}

// =============================================
// SINGLETON EXPORT
// =============================================

export default new EmailService();
