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
const TYPENAME_COURSE = 'course';
const TYPENAME_PAGE = 'page';

/**
 * Generates a JS object based on a YAML or MDX file using gray-matter
 * @param id - identifier in the schema of the file (the ID)
 * @param ctx - access to the server context, specifically the schema
 * @returns JS object containing the metadata and content of the retrieved file
 */
const getSourceFile = async (id, ctx, typename) => {
  if (!ctx.schema[id] || ctx.schema[id].typename !== typename) {
    return null;
  }
  const filepath = ctx.schema[id].filepath;
  const file = await fs.readFile(path.join(process.cwd(), filepath), 'utf8');
  const { data, content } = matter(file);

  return { ...data, content: content.trim() };
};

const writeSourceFile = async (id, filetype, frontMatter, content, parentId) => {
  let filepath;
  if (filetype === TYPENAME_COURSE) {
    filepath = path.join(process.cwd(), `content/${id}/course.yaml`);
  } else {
    filepath = path.join(process.cwd(), `content/${parentId}/pages/${id}.mdx`);
  }
  const output = matter.stringify(content ? content : '', frontMatter);
  fs.writeFile(filepath, output);
};

let schema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    Query: {
      course: async (parent, args, ctx) => {
        return await getSourceFile(args.id, ctx, TYPENAME_COURSE);
      },
      page: async (parent, args, ctx) => {
        return await getSourceFile(args.id, ctx, TYPENAME_PAGE);
      },
      /**
       * Return an array of Strings representing the course ID's
       */
      listCourses: async (parent, args, ctx) => {
        console.debug(ctx);
        const courseList = Object.keys(ctx.schema).filter(
          (key) => ctx.schema[key].typename === TYPENAME_COURSE,
        );
        return courseList;
      },
      /**
       * Return an array of String representing the unit ID's for a given Course
       * @param parent
       * @param args - args.courseId is required
       * @param ctx
       */
      listUnits: async (parent, args, ctx) => {
        const courseFile = await getSourceFile(args.courseId, ctx, TYPENAME_COURSE);
        return courseFile && courseFile.units ? courseFile.units.map((unit) => unit.id) : null;
      },
    },
    Unit: {
      pages: async (parent, args, ctx) => {
        //console.log([parent, args, ctx]);
        return await parent.pages.map(async (page) => {
          return await getSourceFile(page, ctx, TYPENAME_PAGE);
        });
      },
    },
    Mutation: {
      /**
       * Save the page data to an MDX file under the pages directory.
       * Also, ensure that the course.yml for this course has the appropriate pageId assigned to the appropriate unit.
       */
      savePage: async (parent, args, ctx) => {
        const filepath = writeSourceFile(
          args.input.id,
          TYPENAME_PAGE,
          {
            id: args.input.id,
            type: TYPENAME_PAGE,
            title: args.input.title,
          },
          args.input.content,
          args.input.courseId,
        );
        ctx[args.input.id] = {
          typename: TYPENAME_PAGE,
          filepath,
        };
        // find the pages and add it into the metadata
        const courseFile = await getSourceFile(args.input.courseId, ctx, TYPENAME_COURSE);
        const unit = courseFile.units.forEach((unit) => {
          if (unit.id === args.input.unitId) {
            if (!unit.pages) {
              unit.pages = [args.input.id];
            } else {
              unit.pages.splice(args.input.pageOrder, 0, args.input.id);
              console.debug(unit.pages);
            }
          }
        });
        //console.debug(courseFile);
        writeSourceFile(args.input.courseId, TYPENAME_COURSE, courseFile, null, null);

        return {
          id: args.input.id,
          title: args.input.title,
          content: args.input.content,
        };
      },
      deletePage: async (parent, args, ctx) => {
        /*try {
          console.log(args, ctx[args.pageId]);
          console.log(ctx[args.pageId].filepath);
          const filepath = path.join(process.cwd(), ctx[args.pageId].filepath);
          console.log(filepath);
          fs.unlink(filepath, (err => {
            if (err) {
                throw err;
            }
        
            console.log(`Delete ${filepath} successfully.`);
          }));
          return true;
        } catch (e) {
          return false;
        }*/
      },
    },
  },
});

const fileMap = getSchema();

const server = new ApolloServer({
  schema,
  context: async () => {
    const schema = fileMap;
    //console.debug(fileMap);
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
