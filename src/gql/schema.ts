import { gql } from 'apollo-server';

const Query = gql`
  type Query {
    page(id: String!): Page
    course(id: String!): Course
    listCourses: [String]
    listUnits(courseId: String!): [String]
  }

  type Mutation {
    savePage(input: PageInput!): Page!
    deletePage(pageId: String!, courseId: String!): Boolean!
  }

  input PageInput {
    id: String!
    unitId: String!
    pageOrder: Int!
    courseId: String!
    title: String!
    content: String!
  }

  type Page {
    id: String!
    title: String
    content: String
  }

  type Unit {
    id: String!
    title: String
    pages: [Page]
  }

  type Course {
    id: String!
    title: String
    units: [Unit]
  }
`;

const typeDefs = [Query];

export default typeDefs;
