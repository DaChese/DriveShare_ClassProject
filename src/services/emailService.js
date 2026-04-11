// =============================================
// EMAIL SERVICE
// DriveShare email notification service
// Updated: 2024-12-19
// =============================================

import nodemailer from 'nodemailer';

// EmailService - Sends emails when stuff happens in the app //
// Uses nodemailer; falls back to console logging if email's off ////
class EmailService {
  constructor() {
    // Okay, set up the mail transporter //////
    // If running in production, replace with real SMTP creds //
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-app-password'
      }
    });

    this.enabled = process.env.EMAIL_ENABLED === 'true';
  }

  // Actually send the email (or log it if disabled) ////
  // Check: is email on? If yes, fire it off; if no, just console log //////
  // Heads up: handles errors gracefully, returns success/fail flag //
  async sendEmail(to, subject, html, text = '') {
    if (!this.enabled) {
      console.log(`📧 EMAIL DISABLED - Would send to ${to}: ${subject}`);
      return true;
    }

    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'driveshare@example.com',
        to,
        subject,
        html,
        text: text || this.stripHtml(html)
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Email sent to ${to}: ${info.messageId}`);
      return true;
    } catch (error) {
      console.error(`❌ Email failed to ${to}:`, error.message);
      return false;
    }
  }

  // Strip HTML tags to make plain text fallback ////
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  // =============================================
  // NOTIFICATION METHODS
  // =============================================

  // Tell owner: someone wants to book their car //////
  // Includes all booking details so they can decide //
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

  // Tell renter: booking is locked in ////
  // Pass owner contact info so they can coordinate //////
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

  // Tell owner: payment came through, we're good to go ////
  // Heads up: booking is now confirmed and ready //////
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

  // Tell someone they got reviewed //
  // Includes stars, comment, and link to see it in their history ////
  async sendReviewNotification(revieweeEmail, reviewerName, review, booking) {
    const subject = `New Review from ${reviewerName}`;
    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    const html = `
      <h2>New Review Received</h2>
      <p>You have received a new review for booking #${booking.id}.</p>
      <h3>Review Details:</h3>
      <ul>
        <li><strong>Reviewer:</strong> ${reviewerName}</li>
        <li><strong>Rating:</strong> ${stars} (${review.rating}/5)</li>
        ${review.comment ? `<li><strong>Comment:</strong> "${review.comment}"</li>` : ''}
      </ul>
      <p><a href="http://localhost:3000/history.html">View in History</a></p>
    `;

    return await this.sendEmail(revieweeEmail, subject, html);
  }

  // Tell someone: new message arrived about a car //////
  // Link them back to the messages section //
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

// Export singleton instance
export default new EmailService();