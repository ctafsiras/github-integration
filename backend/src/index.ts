import express from "express";
import { config } from "dotenv";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import session from "express-session";
import cors from "cors";
import { CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";


config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 3001;

// DynamoDB setup
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Middleware
app.use(cors({ origin: "https://github-integration-s21e.vercel.app", credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: "https://github-integration-opal.vercel.app/auth/github/callback",
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: passport.Profile,
      done: (error: any, user?: any) => void
    ) => {
      const user = {
        id: profile.id,
        username: profile.username,
        accessToken,
        refreshToken,
      };

      // Save user to DynamoDB
      const command = new PutCommand({
        TableName: "Users",
        Item: user,
      });

      try {
        await docClient.send(command);
        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  const command = new GetCommand({
    TableName: "Users",
    Key: { id },
  });

  try {
    const { Item } = await docClient.send(command);
    done(null, Item);
  } catch (error) {
    done(error as Error);
  }
});

async function createUsersTableIfNotExists() {
  try {
    // Check if table already exists
    await dynamoClient.send(new DescribeTableCommand({ TableName: "Users" }));
    console.log("Users table already exists");
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      // Table doesn't exist, so create it
      const params = {
        TableName: "Users",
        KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
        AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      };
      try {
        await dynamoClient.send(new CreateTableCommand({
          TableName: "Users",
          KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
          AttributeDefinitions: [{ AttributeName: "id", AttributeType: "S" }],
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
        }));
        console.log("Users table created successfully");
      } catch (createError) {
        console.error("Error creating Users table:", createError);
        throw createError;
      }
    } else {
      console.error("Error checking Users table:", error);
      throw error;
    }
  }
}

// Routes
app.get("/auth/github", passport.authenticate("github", { scope: ["repo"] }));

app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("https://github-integration-s21e.vercel.app/dashboard");
  }
);

app.get("/api/user", (req, res) => {
  res.json(req.user || null);
});

app.post("/api/feedback", async (req:any, res:any) => {
  const { title, body } = req.body as { title: string; body: string };
  const user = req.user as { accessToken?: string } | undefined;

  if (!user || !user.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log(`Creating demo issue: ${title}`);

  res.json({ message: "Feedback submitted successfully" });
});

createUsersTableIfNotExists().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}).catch(error => {
  console.error("Failed to start server:", error);
});
