# ggNext
Express.js app that allows Twitch.tv viewers to challenge the streamer. ggNext maintains a queue of challengers and integrates with Twitch.tv chatbots (currently only Nightbot).

## Development Environment
To set up a development environment for ggNext, it's advised to use Docker. Additionally, you will also need Docker Compose.

### Quickstart with Docker
1. Clone this repo
2. From the repo directory, run `npm run configure dev`. Since ggNext uses OpenID Connect with Twitch.tv for user authentication, you will prompted to enter a Twitch.tv client id and client secret. These may be obtained from https://dev.twitch.tv/. The dev environment's OAuth redirect url will be: `http://localhost:5000/authorization`
3. Run `npm run dev`. This will start the development environment. The dev server listens on port 5000.

### Testing
To run tests: `npm run test`
