import { makeExecutableSchema } from '@graphql-tools/schema';
import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import polka from 'polka';
import merge from 'lodash.merge';

import typeDefs from './gql/schema';
import getSchema from './getSchema';
import { resolvers as CourseResolvers } from './resolvers/course';
import { resolvers as UnitResolvers } from './resolvers/unit';
import { resolvers as PageResolvers } from './resolvers/page';

const PORT = process.env.PORT || 3000;

let schema = makeExecutableSchema({
  typeDefs,
  resolvers: merge(CourseResolvers, UnitResolvers, PageResolvers),
});

const fileMap = getSchema();

const server = new ApolloServer({
  schema,
  context: async () => {
    const schema = fileMap;
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
