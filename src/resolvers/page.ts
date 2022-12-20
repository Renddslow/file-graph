import { TYPENAMES, getSourceFile, writeSourceFile } from '../utils';
import kebabCase from 'lodash.kebabcase';
import path from 'path';
import fs from 'fs/promises';

export const resolvers = {
  Query: {
    page: async (parent, args, ctx) => {
      return await getSourceFile(args.id, ctx, TYPENAMES.PAGE);
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
      const courseFile = await getSourceFile(courseId, ctx, TYPENAMES.COURSE);
      if (!courseFile) {
        throw new Error(`${courseId} not found`);
      }
      const id = args.input.id || kebabCase(args.input.title);
      args.input.id = id;
      await writeSourceFile(
        ctx,
        id,
        TYPENAMES.PAGE,
        {
          id: id,
          type: TYPENAMES.PAGE,
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
      await writeSourceFile(ctx, courseId, TYPENAMES.COURSE, courseFile, null, null);

      return {
        id: id,
        title: args.input.title,
        content: args.input.content,
      };
    },
    deletePage: async (parent, args, ctx) => {
      try {
        const { pageId, courseId, unitId } = args;
        console.debug(`Deleting page ${pageId} in course ${courseId}`, [args, ctx.schema[pageId]]);
        const courseFile = await getSourceFile(courseId, ctx, TYPENAMES.COURSE);
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
        await writeSourceFile(ctx, courseId, TYPENAMES.COURSE, courseFile, null, null);

        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    },
  },
};
