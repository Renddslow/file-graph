import { gql } from 'apollo-server';

const Query = gql`
  type Query {
    page(id: String!): Page
    course(id: String!): Course
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
