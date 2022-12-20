import { makeExecutableSchema } from '@graphql-tools/schema';
import { ApolloServer } from 'apollo-server-express';
import cors from 'cors';
import polka from 'polka';
import matter from 'gray-matter';
import fs from 'fs/promises';
import path from 'path';
import kebabCase from 'lodash.kebabcase';

import typeDefs from './gql/schema';
import getSchema from './getSchema';

const PORT = process.env.PORT || 3000;
const TYPENAME_COURSE = 'course';
const TYPENAME_UNIT = 'unit';
const TYPENAME_PAGE = 'page';

/**
 * Generates a JS object based on a YAML or MDX file using gray-matter
 * @param id - identifier in the schema of the file (the ID)
 * @param ctx - access to the server context, specifically the schema
 * @returns JS object containing the metadata and content of the retrieved file
 */
const getSourceFile = async (id: string, ctx: any, typename: string): Promise<any> => {
  if (!ctx.schema[id] || ctx.schema[id].typename !== typename) {
    return null;
  }
  const filepath = ctx.schema[id].filepath;
  //console.debug(filepath);
  const file = await fs.readFile(path.join(process.cwd(), filepath), 'utf8');
  const { data, content } = matter(file);

  return { ...data, content: content.trim() };
};

const writeSourceFile = async (
  ctx: any,
  id: string,
  filetype: string,
  frontMatter: object,
  content: string,
  parentId: string,
): Promise<void> => {
  let filepath;
  if (filetype === TYPENAME_COURSE) {
    filepath = `content/${id}/course.yaml`;
  } else {
    filepath = `content/${parentId}/pages/${id}.mdx`;
  }
  const output = matter.stringify(content ? content : '', frontMatter);
  await fs.writeFile(path.join(process.cwd(), filepath), output);
  ctx.schema[id] = {
    typename: filetype,
    filepath,
  };
};

const setupCourseDirs = async (id: string): Promise<void> => {
  const courseDirPath = path.join(process.cwd(), `content/${id}`);
  await fs.mkdir(courseDirPath);
  const pagesDirPath = path.join(process.cwd(), `content/${id}/pages`);
  await fs.mkdir(pagesDirPath);
};

const hasValidPageFields = (p: any): boolean => {
  return (
    p.id !== undefined &&
    p.title !== undefined &&
    p.content !== undefined &&
    p.pageOrder !== undefined
  );
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
        //console.debug(ctx);
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
      listUnits: async (parent, args, ctx): Promise<string[]> => {
        const courseFile = await getSourceFile(args.courseId, ctx, TYPENAME_COURSE);
        return courseFile && courseFile.units ? courseFile.units.map((unit) => unit.id) : null;
      },
    },
    Unit: {
      pages: async (parent, args, ctx) => {
        //console.log([parent, args, ctx]);
        return await parent.pages?.map(async (page) => {
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
        const courseId = parent?.input?.courseId || args.courseId || args.input.courseId;
        const unitId = parent?.input?.unitId || args.unitId || args.input.unitId;
        // find the pages and add it into the metadata
        const courseFile = await getSourceFile(courseId, ctx, TYPENAME_COURSE);
        if (!courseFile) {
          throw new Error(`${courseId} not found`);
        }
        const id = args.input.id || kebabCase(args.input.title);
        args.input.id = id;
        await writeSourceFile(
          ctx,
          id,
          TYPENAME_PAGE,
          {
            id: id,
            type: TYPENAME_PAGE,
            title: args.input.title,
          },
          args.input.content,
          args.input.courseId,
        );
        courseFile.units.forEach((unit) => {
          if (unit.id === unitId) {
            if (unit.pages === undefined || unit.pages.length === 0) {
              unit.pages = [id];
            } else {
              const currentPageIndex = unit.pages.findIndex((p) => p.id === id);
              if (currentPageIndex > -1) {
                unit.pages.splice(currentPageIndex, 1);
              }
              unit.pages.splice(args.input.pageOrder, 0, id);
              console.debug(unit.pages);
            }
          }
        });
        //console.debug(courseFile);
        await writeSourceFile(ctx, courseId, TYPENAME_COURSE, courseFile, null, null);

        return {
          id: id,
          title: args.input.title,
          content: args.input.content,
        };
      },
      deletePage: async (parent, args, ctx) => {
        try {
          const { pageId, courseId, unitId } = args;
          console.debug(`Deleting page ${pageId} in course ${courseId}`, [
            args,
            ctx.schema[pageId],
          ]);
          const courseFile = await getSourceFile(courseId, ctx, TYPENAME_COURSE);
          if (!courseFile) {
            throw new Error(`${courseId} not found`);
          }
          //console.log(ctx.schema[args.pageId].filepath);
          const filepath = path.join(process.cwd(), ctx.schema[args.pageId].filepath);
          console.debug(`Deleting ${filepath}`);
          fs.unlink(filepath);
          //writing this to make the args.unitId optional
          if (unitId) {
            const unit = courseFile.units.find((unit) => unit.id === unitId);
            const i = unit.pages ? unit.pages.findIndex((p) => p === pageId) : -1;
            if (i > -1) {
              console.debug(`Removing page index ${i} for ${pageId} for unit ${unit.id}`);
              unit.pages.splice(i, 1);
            }
          } else {
            courseFile.units.forEach((unit) => {
              if (unit.pages) {
                const i = unit.pages.findIndex((p) => p === pageId);
                if (i > -1) {
                  console.debug(`Removing page index ${i} for ${pageId} for unit ${unit.id}`);
                  unit.pages.splice(i, 1);
                }
              }
            });
          }
          //console.debug(courseFile);
          await writeSourceFile(ctx, courseId, TYPENAME_COURSE, courseFile, null, null);

          return true;
        } catch (e) {
          console.error(e);
          return false;
        }
      },
      saveUnit: async (parent, args, ctx) => {
        try {
          const { title, courseId, unitOrder } = args.input;
          const courseFile = await getSourceFile(courseId, ctx, TYPENAME_COURSE);
          if (!courseFile) {
            console.debug(`Saving a unit in course ${courseId}`, ctx.schema[courseId]);
            throw new Error(`${courseId} not found`);
          }

          const id = args.input.id || kebabCase(title);
          const unitIndex = courseFile.units ? courseFile.units.findIndex((u) => u.id === id) : -1;
          let pageList = args.input.pages ? args.input.pages.map((p): string[] => p.id) : null;
          //if no page list was passed in and this is an existing unit, get the page list from that existing unit
          if (!pageList && unitIndex > -1) {
            pageList = courseFile.units[unitIndex].pages;
          }
          const saveUnit = {
            id,
            title,
            type: TYPENAME_UNIT,
            pages: [],
          };
          if (pageList) {
            saveUnit.pages = pageList;
          } else {
            delete saveUnit.pages;
          }

          //if the unit is found, remove it.
          if (unitIndex > -1) {
            courseFile.units.splice(unitIndex, 1);
          }
          //and add the new unit
          courseFile.units.splice(unitOrder, 0, saveUnit);
          console.debug(`Writing course ${courseId} to file`, courseFile);
          await writeSourceFile(ctx, courseId, TYPENAME_COURSE, courseFile, null, null);

          //generate return object
          const returnUnit = {
            id,
            title,
            pages: [],
          };
          if (saveUnit.pages) {
            returnUnit.pages = saveUnit.pages.map(async (p) => {
              return await getSourceFile(p, ctx, TYPENAME_PAGE);
            });
          }
          return returnUnit;
        } catch (e) {
          console.error(e);
          throw e;
        }
      },
      deleteUnit: async (parent, args, ctx) => {
        const { unitId, courseId } = args;
        try {
          const courseFile = await getSourceFile(courseId, ctx, TYPENAME_COURSE);
          if (!courseFile) {
            throw new Error(`${courseId} not found`);
          }

          const i = courseFile.units.findIndex((u) => u.id === unitId);
          if (i > -1) {
            courseFile.units.splice(i, 1);
            await writeSourceFile(ctx, courseId, TYPENAME_COURSE, courseFile, null, null);
            return true;
          }
        } catch (e) {
          console.error(e);
        }
        return false;
      },
      saveCourse: async (parent, args, ctx) => {
        const { title, version, subtitle, author, units } = args.input;
        const courseId = args.input.id || kebabCase(title);
        let courseFile = await getSourceFile(courseId, ctx, TYPENAME_COURSE);
        if (!courseFile) {
          console.debug(`Setting up a course directory for ${courseId}`);
          await setupCourseDirs(courseId);
          courseFile = {};
        }
        courseFile.id = courseId || courseFile.id;
        courseFile.type = TYPENAME_COURSE;
        courseFile.title = title || courseFile.title;
        courseFile.version = version || courseFile.version;
        courseFile.subtitle = subtitle || courseFile.subtitle;
        courseFile.author = author || courseFile.author;
        if (units) {
          courseFile.units = [];
          units.forEach(async (unit: any): Promise<void> => {
            //cycle through the pages and save them if they're present
            unit.pages?.forEach(async (p) => {
              p.id = p.id || kebabCase(p.title);
              if (hasValidPageFields(p)) {
                //save the page file
                console.debug(`Writing page ${p.id}`);
                await writeSourceFile(
                  ctx,
                  p.id,
                  TYPENAME_PAGE,
                  {
                    id: p.id,
                    type: TYPENAME_PAGE,
                    title: p.title,
                  },
                  p.content,
                  courseId,
                );
              } else {
                console.debug(`Page did not contain the correct fields`, p);
              }
            });
            unit.id = unit.id || kebabCase(unit.title);
            const newUnit = {
              id: unit.id,
              title: unit.title,
              type: TYPENAME_UNIT,
              pages: unit.pages?.map((p) => p.id),
            };
            if (unit.pages === undefined || unit.pages.length === 0) {
              delete newUnit.pages;
            }
            courseFile.units.push(newUnit);
          });
        }
        console.debug(`Writing ${courseId}`, courseFile);
        await writeSourceFile(ctx, courseId, TYPENAME_COURSE, courseFile, null, null);
        return {
          id: courseId,
          title: courseFile.title,
          units: courseFile.units?.map(async (unit) => {
            return {
              id: unit.id,
              title: unit.title,
              pages: unit.pages?.map(async (p) => {
                return await getSourceFile(p.id, ctx, TYPENAME_PAGE);
              }),
            };
          }),
        };
      },
    },
  },
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
