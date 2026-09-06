FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY Back_End/pom.xml .
RUN mvn dependency:go-offline -q
COPY Back_End/src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
