/**
 * Filter Pull Requests with requested reviewers only
 * @param {Array} pullRequests Pull Requests to filter
 * @return {Array} Pull Requests to review
 */
function getPullRequestsToReview(pullRequests) {
  return pullRequests.filter(
    (pr) => pr.requested_reviewers.length || pr.requested_teams.length,
  );
}

function getNumberOfWaitingDays(date_1) {
  let date_2 = new Date();
  let difference = date_1.getTime() - date_2.getTime();
  return Math.ceil(difference / (1000 * 3600 * 24));
}

/**
 * Filter Pull Requests without a specific label
 * Filter Pull Requests in Draft state
 * Filter Pull Requests open in the same day
 *
 * @param {Array} pullRequests Pull Requests to filter
 * @param {String} ignoreLabel Pull Request label to ignore
 * @return {Array} Pull Requests without a specific label
 */
function getPullRequestsWithoutLabel(pullRequests, ignoreLabel, waitingTime) {
  return pullRequests
    .filter(
      (pr) => !(pr.labels || []).some((label) => label.name === ignoreLabel),
    )
    .filter(
      (pr) =>
        !pr.draft && getNumberOfWaitingDays(pr.created_at) < waitingTime - 1,
    );
}

/**
 * Count Pull Requests reviewers
 * @param {Array} pullRequests Pull Requests
 * @return {Number} Reviewers number
 */
function getPullRequestsReviewersCount(pullRequests) {
  return pullRequests.reduce(
    (total, pullRequest) => total + pullRequest.requested_reviewers.length,
    0,
  );
}

/**
 * Create an Array of Objects with { url, title, login } properties from a list of Pull Requests
 * @param {Array} pullRequestsToReview Pull Requests
 * @return {Array} Array of Objects with { url, title, login } properties
 */
function createPr2UserArray(pullRequestsToReview) {
  const pr2user = [];
  for (const pr of pullRequestsToReview) {
    for (const user of pr.requested_reviewers) {
      pr2user.push({
        url: pr.html_url,
        title: pr.title,
        login: user.login,
      });
    }
    for (const team of pr.requested_teams) {
      pr2user.push({
        url: pr.html_url,
        title: pr.title,
        login: team.slug,
      });
    }
  }
  return pr2user;
}

/**
 * Convert a string like "name1:ID123,name2:ID456" to an Object { name1: "ID123", name2: "ID456"}
 * @param {String} str String to convert to Object
 * @return {Object} Object with usernames as properties and IDs as values
 */
function stringToObject(str) {
  const map = {};
  if (!str) {
    return map;
  }
  const users = str.split(",");
  users.forEach((user) => {
    const [github, provider] = user.split(":");
    map[github] = provider;
  });
  return map;
}

/**
 * Create a pretty message to print
 * @param {Array} pr2user Array of Object with these properties { url, title, login }
 * @param {Object} github2provider Object containing usernames as properties and IDs as values
 * @param {String} provider Service to use: slack or msteams
 * @return {String} Pretty message to print
 */
function prettyMessage(pr2user, github2provider, provider) {
  let message = "";
  for (const obj of pr2user) {
    switch (provider) {
      case "slack": {
        const mention = github2provider[obj.login]
          ? `<@${github2provider[obj.login]}>`
          : `@${obj.login}`;
        message += `Hey ${mention}, the PR "${obj.title}" is waiting for your review: ${obj.url}\n`;
        break;
      }
      case "msteams": {
        const mention = github2provider[obj.login]
          ? `<at>${obj.login}</at>`
          : `@${obj.login}`;
        message += `Hey ${mention}, the PR "${obj.title}" is waiting for your review: [${obj.url}](${obj.url})  \n`;
        break;
      }
    }
  }
  return message;
}

/**
 * Create an array of MS teams mention objects for users requested in a review
 * Docs: https://bit.ly/3UlOoqo
 * @param {Object} github2provider Object containing usernames as properties and IDs as values
 * @param {Array} pr2user Array of Object with these properties { url, title, login }
 * @return {Array} MS teams mention objects
 */
function getTeamsMentions(github2provider, pr2user) {
  const mentions = [];
  for (const user of pr2user) {
    mentions.push({
      type: `mention`,
      text: `<at>${user.login}</at>`,
      mentioned: {
        id: github2provider[user.login],
        name: user.login,
      },
    });
  }
  return mentions;
}

/**
 * Formats channel and slack message text into a request object
 * @param {String} channel channel to send the message to
 * @param {String} message slack message text
 * @return {Object} Slack message data object
 */
function formatSlackMessage(channel, message) {
  const messageData = {
    channel: channel,
    username: "Pull Request reviews reminder",
    text: message,
  };
  return messageData;
}

/**
 * Format the MS Teams message request object
 * Docs: https://bit.ly/3UlOoqo
 * @param {String} message formatted message string
 * @param {Array} mentionsArray teams mention objects
 * @return {Object} Ms Teams message data object
 */
function formatTeamsMessage(message, mentionsArray) {
  const messageData = {
    type: `message`,
    attachments: [
      {
        contentType: `application/vnd.microsoft.card.adaptive`,
        content: {
          type: `AdaptiveCard`,
          body: [
            {
              type: `TextBlock`,
              text: message,
              wrap: true,
            },
          ],
          $schema: `http://adaptivecards.io/schemas/adaptive-card.json`,
          version: `1.0`,
          msteams: {
            width: "Full",
            entities: mentionsArray,
          },
        },
      },
    ],
  };

  return messageData;
}

module.exports = {
  getPullRequestsToReview,
  getPullRequestsWithoutLabel,
  getPullRequestsReviewersCount,
  createPr2UserArray,
  stringToObject,
  prettyMessage,
  getTeamsMentions,
  formatTeamsMessage,
  formatSlackMessage,
};
