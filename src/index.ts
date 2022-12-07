import { makeExecutableSchema } from '@graphql-tools/schema';
import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import polka from 'polka';
import matter from 'gray-matter';
import fs from 'fs/promises';
import path from 'path';

import typeDefs from './gql/schema';
import getSchema from './getSchema';

const PORT = process.env.PORT || 3000;

let schema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: {
      course: async (parent, args, ctx) => {
        if (!ctx.schema[args.id] || ctx.schema[args.id].typename !== 'course') {
          return null;
        }

        const filepath = ctx.schema[args.id].filepath;
        const file = await fs.readFile(path.join(process.cwd(), filepath), 'utf8');
        const { data, content } = matter(file);

        return { ...data, content: content.trim() };
      },
      page: async (parent, args, ctx) => {
        if (!ctx.schema[args.id] || ctx.schema[args.id].typename !== 'page') {
          return null;
        }

        const filepath = ctx.schema[args.id].filepath;
        const file = await fs.readFile(path.join(process.cwd(), filepath), 'utf8');
        const { data, content } = matter(file);

        return { ...data, content: content.trim() };
      },
    },
  },
});

const fileMap = getSchema();

const server = new ApolloServer({
  schema,
  context: async () => {
    const schema = fileMap;
    console.log(fileMap);
    return { schema };
  },
});

!(async () => {
  await server.start();

  const app = polka().use(
    cors({
      origin: (o, cb) => cb(null, true),
    }),
  );

  server.applyMiddleware({ app, path: '/graphql' });
  app.listen(PORT, () => console.log(`Learn.Bible GraphQL API running on port ${PORT}`));
})();
