exports.liveStreamStartedEmail = (
  studentName,
  streamTitle,
  courseName,
  instructorName,
  joinUrl
) => {
  return `<!DOCTYPE html>
  <html>

  <head>
      <meta charset="UTF-8">
      <title>Live Class Started</title>

      <style>
          body {
              background-color: #ffffff;
              font-family: Arial, sans-serif;
              font-size: 16px;
              line-height: 1.4;
              color: #333333;
              margin: 0;
              padding: 0;
          }

          .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              text-align: center;
          }

          .logo {
              max-width: 200px;
              margin-bottom: 20px;
          }

          .message {
              font-size: 22px;
              font-weight: bold;
              color: #EF476F;
              margin-bottom: 20px;
          }

          .body {
              font-size: 16px;
              margin-bottom: 20px;
          }

          .cta {
              display: inline-block;
              padding: 12px 24px;
              background-color: #FFD60A;
              color: #000000;
              text-decoration: none;
              border-radius: 5px;
              font-size: 16px;
              font-weight: bold;
              margin-top: 20px;
          }

          .support {
              font-size: 14px;
              color: #999999;
              margin-top: 20px;
          }

          .highlight {
              font-weight: bold;
              color: #000000;
          }

          .info-box {
              background-color: #F4F4F4;
              padding: 15px;
              border-radius: 8px;
              margin-top: 20px;
              text-align: left;
          }
      </style>

  </head>

  <body>
      <div class="container">

          <a href="https://study-notion-frontend-zeta.vercel.app/">
              <img
                class="logo"
                src="https://mir-s3-cdn-cf.behance.net/projects/404/67d69d240373459.Y3JvcCwxMjI3LDk2MCwzNDYsMA.png"
                alt="StudyNotion Logo"
              />
          </a>

          <div class="message">
              🔴 Live Class Started
          </div>

          <div class="body">

              <p>Dear ${studentName},</p>

              <p>
                  Your live class is now in progress.
                  Click the button below to join immediately.
              </p>

              <div class="info-box">
                  <p>
                      <strong>Course:</strong>
                      ${courseName}
                  </p>

                  <p>
                      <strong>Stream Title:</strong>
                      ${streamTitle}
                  </p>

                  <p>
                      <strong>Instructor:</strong>
                      ${instructorName}
                  </p>
              </div>

              <a
                  class="cta"
                  href="${joinUrl}"
              >
                  Join Live Class
              </a>

              <p style="margin-top:20px;">
                  If the button doesn't work,
                  copy and paste the following link into your browser:
              </p>

              <p>
                  ${joinUrl}
              </p>

          </div>

          <div class="support">
              If you have any questions or need assistance,
              please feel free to reach out to us at
              <a href="mailto:info@studynotion.com">
                  info@studynotion.com
              </a>.
          </div>

      </div>
  </body>

  </html>`;
};