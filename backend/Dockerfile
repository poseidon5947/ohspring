FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -B package
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S platform && adduser -S platform -G platform
COPY --from=build /app/target/platform-1.0.0.jar app.jar
USER platform
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]
