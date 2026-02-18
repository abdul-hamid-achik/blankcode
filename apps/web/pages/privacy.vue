<template>
  <div class="container py-12">
    <div class="max-w-3xl mx-auto prose prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-primary prose-li:text-muted-foreground">
      <h1>Privacy Policy</h1>
      <p class="text-sm text-muted-foreground">Last updated: February 2026</p>

      <h2>Overview</h2>
      <p>
        BlankCode is an open-source code practice platform. We are committed to protecting your
        privacy and being transparent about the data we collect.
      </p>

      <h2>Information We Collect</h2>
      <h3>Account Information</h3>
      <p>
        When you create an account, we collect your email address and a hashed version of your
        password. We never store passwords in plain text.
      </p>

      <h3>Usage Data</h3>
      <p>We store the following data to provide the service:</p>
      <ul>
        <li>Code submissions you make for exercises</li>
        <li>Exercise progress and completion status</li>
        <li>Test results from code execution</li>
      </ul>

      <h3>Code Execution</h3>
      <p>
        Code you submit is executed in isolated Docker sandboxes. Submitted code is stored only for
        the purpose of showing your submission history and is not shared with third parties.
      </p>

      <h2>How We Use Your Information</h2>
      <p>Your information is used exclusively to:</p>
      <ul>
        <li>Provide and maintain the BlankCode platform</li>
        <li>Track your learning progress across exercises and tracks</li>
        <li>Execute and evaluate your code submissions</li>
      </ul>

      <h2>Data Storage</h2>
      <p>
        All data is stored in a PostgreSQL database. If you self-host BlankCode, your data stays
        entirely on your own infrastructure.
      </p>

      <h2>Third-Party Services</h2>
      <p>
        BlankCode may use the Anthropic API for exercise content generation. No user-submitted code
        or personal data is sent to third-party APIs.
      </p>

      <h2>Data Deletion</h2>
      <p>
        You may request deletion of your account and all associated data by contacting the platform
        administrator.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this policy from time to time. Changes will be reflected on this page with an
        updated date.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy-related questions, please open an issue on the
        <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub repository</a>.
      </p>
    </div>
  </div>
</template>
